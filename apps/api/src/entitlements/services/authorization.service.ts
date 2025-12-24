import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  AuthorizationRequest,
  AuthorizationResponse,
  ComputedUserPermissions,
  UserEntitlement,
  Permission,
  PermissionGroup,
  DefaultGroupAssignment,
  UserEntitlementStatus,
} from '@ursly/access-control';
import {
  IAuthorizationService,
  IPermissionRepository,
  IPermissionGroupRepository,
  IUserEntitlementRepository,
  IDefaultGroupAssignmentRepository,
  IEntitlementAuditLogRepository,
  PERMISSION_REPOSITORY,
  PERMISSION_GROUP_REPOSITORY,
  USER_ENTITLEMENT_REPOSITORY,
  DEFAULT_GROUP_ASSIGNMENT_REPOSITORY,
  ENTITLEMENT_AUDIT_LOG_REPOSITORY,
} from '../ports/entitlement.port';

@Injectable()
export class AuthorizationService implements IAuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  // In-memory cache for computed permissions (in production, use Redis)
  private permissionsCache = new Map<
    string,
    { data: ComputedUserPermissions; expiresAt: Date }
  >();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @Inject(PERMISSION_REPOSITORY)
    private readonly permissionRepository: IPermissionRepository,
    @Inject(PERMISSION_GROUP_REPOSITORY)
    private readonly groupRepository: IPermissionGroupRepository,
    @Inject(USER_ENTITLEMENT_REPOSITORY)
    private readonly entitlementRepository: IUserEntitlementRepository,
    @Inject(DEFAULT_GROUP_ASSIGNMENT_REPOSITORY)
    private readonly defaultGroupRepository: IDefaultGroupAssignmentRepository,
    @Inject(ENTITLEMENT_AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IEntitlementAuditLogRepository,
  ) {}

  /**
   * Main authorization check - called by guards and middleware
   */
  async authorize(
    request: AuthorizationRequest,
  ): Promise<AuthorizationResponse> {
    const {
      userId,
      email,
      organizationId,
      resource,
      action,
      resourceId,
      context,
    } = request;
    const permissionCode = `${resource}:${action}`;

    try {
      // Step 1: Validate entitlements (check email match, status, expiration)
      const isValid = await this.validateEntitlements(
        userId,
        email,
        organizationId,
      );
      if (!isValid) {
        await this.logAuthorizationAttempt(
          organizationId,
          userId,
          email,
          'authorization_denied',
          {
            permissionCode,
            reason: 'Invalid or suspended entitlements',
          },
        );

        return {
          allowed: false,
          permissions: [],
          groups: [],
          reason:
            'Your access has been suspended or is invalid. Please contact your administrator.',
          validatedAt: new Date(),
        };
      }

      // Step 2: Get computed permissions (from cache or compute fresh)
      const computed = await this.getComputedPermissions(
        userId,
        organizationId,
      );
      if (!computed) {
        // User doesn't have entitlements yet - try to provision
        const newEntitlement = await this.provisionNewUser(
          userId,
          email,
          organizationId,
        );
        if (!newEntitlement) {
          return {
            allowed: false,
            permissions: [],
            groups: [],
            reason:
              'Unable to provision access. Please contact your administrator.',
            validatedAt: new Date(),
          };
        }
        // Re-compute after provisioning
        const newComputed = await this.refreshPermissions(
          userId,
          organizationId,
        );
        return this.checkPermission(
          newComputed,
          permissionCode,
          userId,
          email,
          organizationId,
        );
      }

      return this.checkPermission(
        computed,
        permissionCode,
        userId,
        email,
        organizationId,
      );
    } catch (error) {
      this.logger.error(
        `Authorization error for ${userId}: ${error.message}`,
        error.stack,
      );
      return {
        allowed: false,
        permissions: [],
        groups: [],
        reason: 'An error occurred during authorization. Please try again.',
        validatedAt: new Date(),
      };
    }
  }

  /**
   * Check if permission is granted
   */
  private async checkPermission(
    computed: ComputedUserPermissions,
    permissionCode: string,
    userId: string,
    email: string,
    organizationId: string,
  ): Promise<AuthorizationResponse> {
    // Check if permission is in the computed list
    const hasPermission = computed.permissions.includes(permissionCode);

    // Check if permission is explicitly excluded
    const isExcluded = computed.excludedPermissions.includes(permissionCode);

    const allowed = hasPermission && !isExcluded;

    // Log the authorization attempt
    await this.logAuthorizationAttempt(
      organizationId,
      userId,
      email,
      allowed ? 'authorization_granted' : 'authorization_denied',
      { permissionCode, hasPermission, isExcluded },
    );

    return {
      allowed,
      permissions: computed.permissions,
      groups: computed.groups.map((g) => g.name),
      reason: allowed
        ? undefined
        : `You do not have the '${permissionCode}' permission.`,
      validatedAt: computed.computedAt,
      expiresAt: computed.expiresAt,
    };
  }

  /**
   * Get computed permissions (with caching)
   */
  async getComputedPermissions(
    userId: string,
    organizationId: string,
  ): Promise<ComputedUserPermissions | null> {
    const cacheKey = `${organizationId}:${userId}`;

    // Check cache first
    const cached = this.permissionsCache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return cached.data;
    }

    // Compute fresh
    return this.computePermissions(userId, organizationId);
  }

  /**
   * Compute permissions from groups and direct assignments
   */
  private async computePermissions(
    userId: string,
    organizationId: string,
  ): Promise<ComputedUserPermissions | null> {
    // Get user entitlement
    const entitlement = await this.entitlementRepository.findByUserId(
      userId,
      organizationId,
    );
    if (!entitlement) {
      return null;
    }

    // Check if entitlement is active
    if (entitlement.status !== 'active') {
      return {
        userId,
        email: entitlement.email,
        organizationId,
        groups: [],
        permissions: [],
        permissionDetails: [],
        excludedPermissions: entitlement.excludedPermissions || [],
        status: entitlement.status as UserEntitlementStatus,
        computedAt: new Date(),
      };
    }

    // Get all groups the user belongs to
    const groups: PermissionGroup[] = [];
    for (const groupId of entitlement.groupIds) {
      const group = await this.groupRepository.findById(groupId);
      if (group) {
        groups.push(group);
      }
    }

    // Collect all permissions from groups
    const permissionIds = new Set<string>();
    const permissionDetails: ComputedUserPermissions['permissionDetails'] = [];

    for (const group of groups) {
      for (const permId of group.permissions) {
        permissionIds.add(permId);
      }
    }

    // Add direct permissions
    if (entitlement.directPermissions) {
      for (const permId of entitlement.directPermissions) {
        permissionIds.add(permId);
      }
    }

    // Fetch all permissions
    const permissions = await this.permissionRepository.findByIds(
      Array.from(permissionIds),
    );

    // Build permission details
    for (const perm of permissions) {
      // Find which group(s) granted this permission
      for (const group of groups) {
        if (group.permissions.includes(perm.id)) {
          permissionDetails.push({
            code: perm.code,
            name: perm.name,
            source: 'group',
            sourceId: group.id,
            sourceName: group.name,
          });
          break;
        }
      }

      // Check if it's a direct permission
      if (entitlement.directPermissions?.includes(perm.id)) {
        permissionDetails.push({
          code: perm.code,
          name: perm.name,
          source: 'direct',
          sourceId: entitlement.id,
          sourceName: 'Direct Assignment',
        });
      }
    }

    // Get excluded permission codes
    const excludedPermissions: string[] = [];
    if (entitlement.excludedPermissions?.length) {
      const excluded = await this.permissionRepository.findByIds(
        entitlement.excludedPermissions,
      );
      excludedPermissions.push(...excluded.map((p) => p.code));
    }

    const computed: ComputedUserPermissions = {
      userId,
      email: entitlement.email,
      organizationId,
      groups: groups.map((g) => ({ id: g.id, name: g.name, type: g.type })),
      permissions: permissions
        .map((p) => p.code)
        .filter((code) => !excludedPermissions.includes(code)),
      permissionDetails: permissionDetails.filter(
        (pd) => !excludedPermissions.includes(pd.code),
      ),
      excludedPermissions,
      status: entitlement.status as UserEntitlementStatus,
      computedAt: new Date(),
      expiresAt: entitlement.expiresAt,
    };

    // Cache the result
    const cacheKey = `${organizationId}:${userId}`;
    this.permissionsCache.set(cacheKey, {
      data: computed,
      expiresAt: new Date(Date.now() + this.CACHE_TTL_MS),
    });

    return computed;
  }

  /**
   * Validate user entitlements
   */
  async validateEntitlements(
    userId: string,
    email: string,
    organizationId: string,
  ): Promise<boolean> {
    const entitlement = await this.entitlementRepository.findByUserId(
      userId,
      organizationId,
    );

    if (!entitlement) {
      // No entitlement exists - this is OK, we'll provision one
      return true;
    }

    // Check email matches (important security check)
    if (entitlement.email.toLowerCase() !== email.toLowerCase()) {
      this.logger.warn(
        `Email mismatch for user ${userId}: expected ${entitlement.email}, got ${email}`,
      );
      return false;
    }

    // Check status
    if (entitlement.status !== 'active' && entitlement.status !== 'pending') {
      this.logger.warn(`User ${userId} has status: ${entitlement.status}`);
      return false;
    }

    // Check expiration
    if (entitlement.expiresAt && entitlement.expiresAt < new Date()) {
      this.logger.warn(`Entitlement expired for user ${userId}`);
      // Update status to expired
      await this.entitlementRepository.update(entitlement.id, {
        status: 'expired',
      });
      return false;
    }

    // Update last validated timestamp
    await this.entitlementRepository.update(entitlement.id, {
      lastValidatedAt: new Date(),
    });

    return true;
  }

  /**
   * Provision entitlements for a new user
   */
  async provisionNewUser(
    userId: string,
    email: string,
    organizationId: string,
  ): Promise<UserEntitlement> {
    this.logger.log(
      `Provisioning new user: ${email} (${userId}) in org ${organizationId}`,
    );

    // Ensure system permissions are seeded
    await this.permissionRepository.seedSystemPermissions();

    // Check if organization has any groups, if not seed system groups
    const existingGroups =
      await this.groupRepository.findByOrganization(organizationId);
    if (existingGroups.length === 0) {
      this.logger.log(
        `No groups found for org ${organizationId}, seeding system groups...`,
      );
      await this.groupRepository.seedSystemGroups(organizationId);
    }

    // Get default group assignments
    const defaultAssignments =
      await this.defaultGroupRepository.findActiveByOrganization(
        organizationId,
      );
    const groupIds: string[] = [];

    for (const assignment of defaultAssignments) {
      // Check if condition matches
      const matches = await this.evaluateDefaultGroupCondition(
        assignment,
        email,
      );
      if (matches) {
        groupIds.push(assignment.groupId);
      }
    }

    // If no default assignments matched, get groups marked as default
    if (groupIds.length === 0) {
      const defaultGroups =
        await this.groupRepository.findDefaultGroups(organizationId);
      groupIds.push(...defaultGroups.map((g) => g.id));
    }

    // If still no groups (none marked as default), assign to Admin group for first user
    if (groupIds.length === 0) {
      this.logger.log(
        `No default groups found, assigning first user to Admin group`,
      );
      const allGroups =
        await this.groupRepository.findByOrganization(organizationId);
      const adminGroup = allGroups.find((g) => g.name === 'Admin');
      if (adminGroup) {
        groupIds.push(adminGroup.id);
      }
    }

    // Create the entitlement
    const entitlement = await this.entitlementRepository.create({
      userId,
      email,
      organizationId,
      groupIds,
      status: 'active',
    });

    // Log the provisioning
    await this.auditLogRepository.create({
      organizationId,
      action: 'user_assigned_to_group',
      actorId: userId,
      actorEmail: email,
      targetType: 'user_entitlement',
      targetId: entitlement.id,
      changes: { groupIds, isNewUser: true },
    });

    return entitlement;
  }

  /**
   * Evaluate if a default group condition matches
   */
  private async evaluateDefaultGroupCondition(
    assignment: DefaultGroupAssignment,
    email: string,
  ): Promise<boolean> {
    switch (assignment.conditionType) {
      case 'always':
        return true;

      case 'email_domain': {
        if (!assignment.conditionValue) return false;
        const domain = email.split('@')[1]?.toLowerCase();
        return domain === assignment.conditionValue.toLowerCase();
      }

      case 'email_pattern':
        if (!assignment.conditionValue) return false;
        try {
          const regex = new RegExp(assignment.conditionValue, 'i');
          return regex.test(email);
        } catch {
          return false;
        }

      case 'invitation':
        // This would check invitation metadata - not implemented in basic version
        return false;

      default:
        return false;
    }
  }

  /**
   * Refresh cached permissions
   */
  async refreshPermissions(
    userId: string,
    organizationId: string,
  ): Promise<ComputedUserPermissions> {
    const cacheKey = `${organizationId}:${userId}`;
    this.permissionsCache.delete(cacheKey);

    const computed = await this.computePermissions(userId, organizationId);
    if (!computed) {
      throw new Error(`Unable to compute permissions for user ${userId}`);
    }

    return computed;
  }

  /**
   * Invalidate cache for a user
   */
  invalidateCache(userId: string, organizationId: string): void {
    const cacheKey = `${organizationId}:${userId}`;
    this.permissionsCache.delete(cacheKey);
  }

  /**
   * Invalidate cache for all users in a group
   */
  async invalidateCacheForGroup(groupId: string): Promise<void> {
    const entitlements = await this.entitlementRepository.findByGroup(groupId);
    for (const ent of entitlements) {
      this.invalidateCache(ent.userId, ent.organizationId);
    }
  }

  /**
   * Log authorization attempt
   */
  private async logAuthorizationAttempt(
    organizationId: string,
    userId: string,
    email: string,
    action: 'authorization_granted' | 'authorization_denied',
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditLogRepository.create({
        organizationId,
        action,
        actorId: userId,
        actorEmail: email,
        targetType: 'authorization',
        targetId: userId,
        metadata,
      });
    } catch (error) {
      this.logger.error(
        `Failed to log authorization attempt: ${error.message}`,
      );
    }
  }

  /**
   * Bootstrap admin access for a user (development/setup only)
   * This ensures the user has admin access regardless of current state
   */
  async bootstrapAdminUser(
    userId: string,
    email: string,
    organizationId: string,
  ): Promise<UserEntitlement> {
    this.logger.log(
      `Bootstrapping admin access for ${email} (${userId}) in org ${organizationId}`,
    );

    // Ensure system permissions are seeded
    await this.permissionRepository.seedSystemPermissions();

    // Ensure system groups exist for this organization
    const existingGroups =
      await this.groupRepository.findByOrganization(organizationId);
    if (existingGroups.length === 0) {
      this.logger.log(
        `No groups found for org ${organizationId}, seeding system groups...`,
      );
      await this.groupRepository.seedSystemGroups(organizationId);
    }

    // Get the Admin group
    const allGroups =
      await this.groupRepository.findByOrganization(organizationId);
    const adminGroup = allGroups.find((g) => g.name === 'Admin');

    if (!adminGroup) {
      throw new Error('Admin group not found after seeding');
    }

    // Check if user already has an entitlement
    let entitlement = await this.entitlementRepository.findByUserId(
      userId,
      organizationId,
    );

    if (entitlement) {
      // Update existing entitlement to include Admin group
      if (!entitlement.groupIds.includes(adminGroup.id)) {
        entitlement = await this.entitlementRepository.assignToGroups(
          entitlement.id,
          [adminGroup.id],
        );
        this.logger.log(`Added user ${userId} to Admin group`);
      } else {
        this.logger.log(`User ${userId} already in Admin group`);
      }
    } else {
      // Create new entitlement with Admin group
      entitlement = await this.entitlementRepository.create({
        userId,
        email,
        organizationId,
        groupIds: [adminGroup.id],
        status: 'active',
      });
      this.logger.log(`Created admin entitlement for user ${userId}`);
    }

    // Log the bootstrap action
    await this.auditLogRepository.create({
      organizationId,
      action: 'user_assigned_to_group',
      actorId: userId,
      actorEmail: email,
      targetType: 'user_entitlement',
      targetId: entitlement!.id,
      changes: { groupId: adminGroup.id, isBootstrap: true },
    });

    // Refresh permissions cache
    await this.refreshPermissions(userId, organizationId);

    return entitlement!;
  }
}
