import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../../contexts';
import SearchIcon from '@mui/icons-material/Search';
import PersonIcon from '@mui/icons-material/Person';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GroupIcon from '@mui/icons-material/Group';
import SecurityIcon from '@mui/icons-material/Security';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EmailIcon from '@mui/icons-material/Email';
import InfoIcon from '@mui/icons-material/Info';
import AddIcon from '@mui/icons-material/Add';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import {
  userEntitlementsService,
  groupsService,
  UserEntitlement,
  PermissionGroup,
} from '../../services/entitlements.service';
import styles from './Users.module.css';

function formatTimeAgo(date: Date | string | undefined): string {
  if (!date) return 'Never';
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return d.toLocaleDateString();
}

function getInitials(email: string): string {
  const parts = email.split('@')[0].split(/[._-]/);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function Users() {
  const { refreshKey } = useUser();
  const [users, setUsers] = useState<UserEntitlement[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserEntitlement | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  
  // Create User state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserGroups, setNewUserGroups] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, groupsData] = await Promise.all([
        userEntitlementsService.list(),
        groupsService.list(),
      ]);
      setUsers(usersData);
      setGroups(groupsData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load user entitlements. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  useEffect(() => {
    if (snackbar.open) {
      const timer = setTimeout(() => {
        setSnackbar((s) => ({ ...s, open: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [snackbar.open]);

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenAssign = (user: UserEntitlement) => {
    setSelectedUser(user);
    setSelectedGroups(user.groupIds || []);
    setAssignDialogOpen(true);
  };

  const handleSaveAssignment = async () => {
    if (!selectedUser) return;
    try {
      setSaving(true);
      await userEntitlementsService.setGroups(selectedUser.id, selectedGroups);
      setSnackbar({ open: true, message: 'Groups updated successfully', severity: 'success' });
      setAssignDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to update groups:', err);
      setSnackbar({ open: true, message: 'Failed to update groups', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (user: UserEntitlement) => {
    try {
      if (user.status === 'active') {
        await userEntitlementsService.suspend(user.id);
        setSnackbar({ open: true, message: 'User suspended', severity: 'success' });
      } else {
        await userEntitlementsService.activate(user.id);
        setSnackbar({ open: true, message: 'User activated', severity: 'success' });
      }
      fetchData();
    } catch (err) {
      console.error('Failed to toggle status:', err);
      setSnackbar({ open: true, message: 'Failed to update user status', severity: 'error' });
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail.trim()) {
      setSnackbar({ open: true, message: 'Email is required', severity: 'error' });
      return;
    }
    try {
      setCreating(true);
      await userEntitlementsService.create({
        email: newUserEmail.trim(),
        groupIds: newUserGroups,
        status: 'active',
      });
      setSnackbar({ open: true, message: 'User created successfully', severity: 'success' });
      setCreateDialogOpen(false);
      setNewUserEmail('');
      setNewUserGroups([]);
      fetchData();
    } catch (err) {
      console.error('Failed to create user:', err);
      setSnackbar({ open: true, message: 'Failed to create user', severity: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const getGroupInfo = (groupId: string) => {
    return groups.find((g) => g.id === groupId);
  };

  const countPermissions = (groupIds: string[]) => {
    const permSet = new Set<string>();
    groupIds.forEach((gid) => {
      const group = groups.find((g) => g.id === gid);
      group?.permissions?.forEach((p) => permSet.add(p));
    });
    return permSet.size;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <PersonIcon />
            </div>
            <h1 className={styles.headerTitle}>User Entitlements</h1>
          </div>
          <button className={styles.createBtn} onClick={() => setCreateDialogOpen(true)}>
            <AddIcon />
            Create User
          </button>
        </div>
        <p className={styles.headerSubtitle}>
          Manage user access by assigning them to permission groups. Users inherit all permissions from their assigned groups.
        </p>
      </div>

      {error && <div className={styles.errorAlert}>{error}</div>}

      <div className={styles.filtersCard}>
        <div className={styles.filtersRow}>
          <div className={styles.searchInput}>
            <SearchIcon className={styles.searchIcon} />
            <input type="text" placeholder="Search by email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className={styles.statusSelect}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}><div className={styles.statLabel}>Total Users</div><div className={styles.statValue}>{users.length}</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Active</div><div className={`${styles.statValue} ${styles.active}`}>{users.filter((u) => u.status === 'active').length}</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Pending</div><div className={`${styles.statValue} ${styles.pending}`}>{users.filter((u) => u.status === 'pending').length}</div></div>
        <div className={styles.statCard}><div className={styles.statLabel}>Suspended</div><div className={`${styles.statValue} ${styles.suspended}`}>{users.filter((u) => u.status === 'suspended').length}</div></div>
      </div>

      {loading ? (
        <div className={styles.tableCard}>{[...Array(5)].map((_, i) => <div key={i} className={styles.skeleton} />)}</div>
      ) : filteredUsers.length === 0 ? (
        <div className={styles.infoAlert}><InfoIcon />No users found matching your criteria.</div>
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.usersTable}>
            <thead className={styles.tableHeader}>
              <tr>
                <th style={{ width: '25%' }}>User</th>
                <th style={{ width: '20%' }}>Groups</th>
                <th style={{ width: '15%' }}>Permissions</th>
                <th style={{ width: '10%' }}>Status</th>
                <th style={{ width: '15%' }}>Last Active</th>
                <th style={{ width: '15%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className={styles.tableRow}>
                  <td>
                    <div className={styles.userCell}>
                      <div className={styles.userAvatar}>{getInitials(user.email)}</div>
                      <div>
                        <div className={styles.userName}>{user.email.split('@')[0]}</div>
                        <div className={styles.userEmail}><EmailIcon />{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={styles.groupChips}>
                      {user.groupIds?.map((gid) => {
                        const group = getGroupInfo(gid);
                        return <span key={gid} className={styles.groupChip} style={{ backgroundColor: `${group?.color || '#6366f1'}20`, color: group?.color || '#6366f1' }}>{group?.name || gid}</span>;
                      })}
                      {(!user.groupIds || user.groupIds.length === 0) && <span className={styles.noGroups}>No groups</span>}
                    </div>
                  </td>
                  <td><span className={styles.permissionsChip}><SecurityIcon />{countPermissions(user.groupIds || [])}</span></td>
                  <td><span className={`${styles.statusChip} ${styles[user.status]}`}>{user.status}</span></td>
                  <td><span className={styles.lastActive}><AccessTimeIcon />{formatTimeAgo(user.lastValidatedAt)}</span></td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.iconBtn} onClick={() => handleOpenAssign(user)} title="Manage Groups"><GroupIcon style={{ fontSize: 16 }} /></button>
                      <button className={`${styles.iconBtn} ${user.status === 'active' ? styles.danger : styles.success}`} onClick={() => handleToggleStatus(user)} title={user.status === 'active' ? 'Suspend User' : 'Activate User'}>
                        {user.status === 'active' ? <BlockIcon style={{ fontSize: 16 }} /> : <CheckCircleIcon style={{ fontSize: 16 }} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignDialogOpen && selectedUser && (
        <div className={styles.dialog}>
          <div className={styles.dialogOverlay} onClick={() => setAssignDialogOpen(false)} />
          <div className={styles.dialogContent}>
            <div className={styles.dialogHeader}>
              <div className={styles.dialogHeaderTop}><div className={styles.dialogIcon}><GroupIcon /></div><h2 className={styles.dialogTitle}>Assign Groups</h2></div>
              <div className={styles.dialogSubtitle}>{selectedUser.email}</div>
            </div>
            <div className={styles.dialogBody}>
              <div className={styles.dialogSectionTitle}>Select the groups to assign to this user:</div>
              {groups.map((group) => (
                <div key={group.id} className={`${styles.groupSelectItem} ${selectedGroups.includes(group.id) ? styles.selected : ''}`} style={{ backgroundColor: selectedGroups.includes(group.id) ? `${group.color || '#6366f1'}15` : `${group.color || '#6366f1'}05` }} onClick={() => setSelectedGroups((prev) => prev.includes(group.id) ? prev.filter((id) => id !== group.id) : [...prev, group.id])}>
                  <div className={styles.groupSelectInfo}>
                    <div className={styles.groupSelectIcon} style={{ backgroundColor: `${group.color || '#6366f1'}20`, color: group.color || '#6366f1' }}><GroupIcon style={{ fontSize: 20 }} /></div>
                    <div><div className={styles.groupSelectName}>{group.name}</div><div className={styles.groupSelectPerms}>{group.permissions?.length || 0} permissions</div></div>
                  </div>
                  <input type="checkbox" className={styles.groupSelectCheckbox} checked={selectedGroups.includes(group.id)} readOnly style={{ accentColor: group.color || '#6366f1' }} />
                </div>
              ))}
            </div>
            <div className={styles.dialogFooter}>
              <button className={styles.cancelBtn} onClick={() => setAssignDialogOpen(false)}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSaveAssignment} disabled={saving}>{saving ? 'Saving...' : 'Save Assignments'}</button>
            </div>
          </div>
        </div>
      )}

      {createDialogOpen && (
        <div className={styles.dialog}>
          <div className={styles.dialogOverlay} onClick={() => setCreateDialogOpen(false)} />
          <div className={styles.dialogContent}>
            <div className={styles.dialogHeader}>
              <div className={styles.dialogHeaderTop}><div className={styles.dialogIcon}><PersonAddIcon /></div><h2 className={styles.dialogTitle}>Create User</h2></div>
              <div className={styles.dialogSubtitle}>Add a new user to your organization</div>
            </div>
            <div className={styles.dialogBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email Address *</label>
                <input type="email" className={styles.formInput} placeholder="user@example.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Assign to Groups (optional)</label>
                <div className={styles.groupsCheckList}>
                  {groups.map((group) => (
                    <div key={group.id} className={`${styles.groupCheckItem} ${newUserGroups.includes(group.id) ? styles.selected : ''}`} onClick={() => setNewUserGroups((prev) => prev.includes(group.id) ? prev.filter((id) => id !== group.id) : [...prev, group.id])}>
                      <div className={styles.groupCheckIcon} style={{ backgroundColor: `${group.color || '#6366f1'}20`, color: group.color || '#6366f1' }}><GroupIcon style={{ fontSize: 16 }} /></div>
                      <div className={styles.groupCheckInfo}><div className={styles.groupCheckName}>{group.name}</div><div className={styles.groupCheckPerms}>{group.permissions?.length || 0} permissions</div></div>
                      <input type="checkbox" checked={newUserGroups.includes(group.id)} readOnly className={styles.groupCheckbox} style={{ accentColor: group.color || '#6366f1' }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.dialogFooter}>
              <button className={styles.cancelBtn} onClick={() => { setCreateDialogOpen(false); setNewUserEmail(''); setNewUserGroups([]); }}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleCreateUser} disabled={creating || !newUserEmail.trim()}>{creating ? 'Creating...' : 'Create User'}</button>
            </div>
          </div>
        </div>
      )}

      {snackbar.open && <div className={`${styles.snackbar} ${styles[snackbar.severity]}`}>{snackbar.message}</div>}
    </div>
  );
}

export default Users;
