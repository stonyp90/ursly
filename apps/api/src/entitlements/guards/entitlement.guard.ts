import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Inject,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  IAuthorizationService,
  AUTHORIZATION_SERVICE,
} from '../ports/entitlement.port';
import { IS_PUBLIC_KEY } from '../../auth/jwt-auth.guard';

// =============================================================================
// Decorator Keys
// =============================================================================

export const PERMISSIONS_KEY = 'permissions';
export const SKIP_ENTITLEMENT_KEY = 'skipEntitlement';

// =============================================================================
// Decorators
// =============================================================================

/**
 * Require specific permissions for a route
 * @example @RequirePermissions('agents:create', 'agents:update')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Require all specified permissions (AND logic)
 */
export const RequireAllPermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, { permissions, mode: 'all' });

/**
 * Require any of the specified permissions (OR logic)
 */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, { permissions, mode: 'any' });

/**
 * Skip entitlement check for a route
 */
export const SkipEntitlementCheck = () =>
  SetMetadata(SKIP_ENTITLEMENT_KEY, true);

// =============================================================================
// User Context Interface
// =============================================================================

export interface EntitlementUser {
  id: string;
  email: string;
  organizationId: string;
  permissions: string[];
  groups: string[];
}

// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      entitlementUser?: EntitlementUser;
    }
  }
}

// =============================================================================
// Entitlement Guard
// =============================================================================

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTHORIZATION_SERVICE)
    private readonly authorizationService: IAuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route should skip entitlement check
    const skipCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_ENTITLEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipCheck) {
      return true;
    }

    // Also skip if route is marked as public (from JwtAuthGuard)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Extract user info from the authenticated request
    // This assumes Keycloak/OIDC middleware has already validated the JWT
    const user = this.extractUserFromRequest(request);

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Get required permissions from decorator
    const permissionsMetadata = this.reflector.getAllAndOverride<
      string[] | { permissions: string[]; mode: 'all' | 'any' }
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // If no permissions specified, just validate entitlements
    if (!permissionsMetadata) {
      const isValid = await this.authorizationService.validateEntitlements(
        user.id,
        user.email,
        user.organizationId,
      );

      if (!isValid) {
        throw new ForbiddenException(
          'Your access has been suspended or is invalid',
        );
      }

      // Load permissions for the user context
      const computed = await this.authorizationService.getComputedPermissions(
        user.id,
        user.organizationId,
      );

      if (computed) {
        request.entitlementUser = {
          id: user.id,
          email: user.email,
          organizationId: user.organizationId,
          permissions: computed.permissions,
          groups: computed.groups.map((g) => g.name),
        };
      }

      return true;
    }

    // Extract permissions and mode
    let permissions: string[];
    let mode: 'all' | 'any' = 'any';

    if (Array.isArray(permissionsMetadata)) {
      permissions = permissionsMetadata;
    } else {
      permissions = permissionsMetadata.permissions;
      mode = permissionsMetadata.mode;
    }

    // Check each permission
    const results: boolean[] = [];
    let allPermissions: string[] = [];
    let allGroups: string[] = [];

    for (const permission of permissions) {
      const [resource, action] = permission.split(':');

      const response = await this.authorizationService.authorize({
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
        resource,
        action,
      });

      results.push(response.allowed);

      if (response.allowed) {
        allPermissions = response.permissions;
        allGroups = response.groups;
      }
    }

    // Evaluate based on mode
    const isAllowed =
      mode === 'all' ? results.every((r) => r) : results.some((r) => r);

    if (!isAllowed) {
      const requiredStr = permissions.join(mode === 'all' ? ' AND ' : ' OR ');
      throw new ForbiddenException(
        `Access denied. Required permissions: ${requiredStr}`,
      );
    }

    // Attach user context to request
    request.entitlementUser = {
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
      permissions: allPermissions,
      groups: allGroups,
    };

    return true;
  }

  /**
   * Extract user information from the request
   * This integrates with Keycloak/OIDC JWT validation
   */
  private extractUserFromRequest(
    request: Request,
  ): { id: string; email: string; organizationId: string } | null {
    // Check for user from Keycloak/OIDC middleware
    const authUser = (request as any).user;

    if (!authUser) {
      return null;
    }

    // Extract from Keycloak token claims
    const userId = authUser.sub || authUser.id;
    const email = authUser.email;

    // Organization can come from:
    // 1. Request header (X-Organization-Id)
    // 2. Query parameter (organizationId)
    // 3. Token claims (organization, org_id, etc.)
    // 4. Default organization for the user
    const organizationId =
      (request.headers['x-organization-id'] as string) ||
      (request.query['organizationId'] as string) ||
      authUser.organization ||
      authUser.org_id ||
      authUser.tenant_id ||
      'default'; // Fallback

    if (!userId || !email) {
      return null;
    }

    return {
      id: userId,
      email,
      organizationId,
    };
  }
}

// =============================================================================
// Permission Check Utility
// =============================================================================

/**
 * Check if the current user has a specific permission
 * Use this in controllers for fine-grained checks
 */
export function hasPermission(request: Request, permission: string): boolean {
  return request.entitlementUser?.permissions?.includes(permission) ?? false;
}

/**
 * Check if the current user has all specified permissions
 */
export function hasAllPermissions(
  request: Request,
  permissions: string[],
): boolean {
  const userPermissions = request.entitlementUser?.permissions ?? [];
  return permissions.every((p) => userPermissions.includes(p));
}

/**
 * Check if the current user has any of the specified permissions
 */
export function hasAnyPermission(
  request: Request,
  permissions: string[],
): boolean {
  const userPermissions = request.entitlementUser?.permissions ?? [];
  return permissions.some((p) => userPermissions.includes(p));
}
