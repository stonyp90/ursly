import { useState, useEffect, useRef } from 'react';
import { useUser } from '../../contexts';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewListIcon from '@mui/icons-material/ViewList';
import GridViewIcon from '@mui/icons-material/GridView';
import StopIcon from '@mui/icons-material/Stop';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CloseIcon from '@mui/icons-material/Close';
import SecurityIcon from '@mui/icons-material/Security';
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { tasksService, agentsService, TaskAccessControl } from '../../services';
import {
  groupsService,
  userEntitlementsService,
  permissionsService,
  PermissionGroup,
  UserEntitlement,
  Permission,
} from '../../services/entitlements.service';
import styles from './Tasks.module.css';

interface Agent {
  id: string;
  name: string;
  status: string;
}

interface Task {
  id: string;
  title?: string;
  prompt?: string;
  description?: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  agentId?: string;
  agentName?: string;
  createdAt: Date | string;
  startedAt?: Date | string;
  completedAt?: Date | string;
  error?: string;
  accessControl?: TaskAccessControl;
}

// Helper to get display title
const getTaskTitle = (task: Task): string => {
  if (task.title) return task.title;
  if (task.prompt) return task.prompt.slice(0, 50) + (task.prompt.length > 50 ? '...' : '');
  return 'Untitled Task';
};

// Helper to compute progress based on status
const getTaskProgress = (task: Task): number => {
  if (typeof task.progress === 'number') return task.progress;
  switch (task.status) {
    case 'completed': return 100;
    case 'failed': return 0;
    case 'running': return 50;
    case 'pending':
    case 'queued': return 0;
    default: return 0;
  }
};

// Map status for display
const getDisplayStatus = (status: string): 'queued' | 'running' | 'completed' | 'failed' => {
  if (status === 'pending' || status === 'cancelled') return 'queued';
  return status as 'queued' | 'running' | 'completed' | 'failed';
};

export function Tasks() {
  const { refreshKey } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [newTask, setNewTask] = useState({
    prompt: '',
    agentId: '',
  });
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Access Control state
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [users, setUsers] = useState<UserEntitlement[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [accessControlExpanded, setAccessControlExpanded] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [accessSearchQuery, setAccessSearchQuery] = useState('');
  const [accessTab, setAccessTab] = useState<'users' | 'groups' | 'permissions'>('users');

  // Manage Access Modal state
  const [manageAccessTask, setManageAccessTask] = useState<Task | null>(null);
  const [savingAccess, setSavingAccess] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAgentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await agentsService.list();
      setAgents((response.agents || []) as Agent[]);
    } catch (err) {
      console.error('Failed to fetch agents', err);
    }
  };

  const fetchAccessControlData = async () => {
    try {
      const [groupsData, usersData, permissionsData] = await Promise.all([
        groupsService.list(),
        userEntitlementsService.list(),
        permissionsService.list(),
      ]);
      setGroups(groupsData);
      setUsers(usersData);
      setPermissions(permissionsData);
    } catch (err) {
      console.error('Failed to fetch access control data', err);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await tasksService.list();
      setTasks((response.tasks || []) as Task[]);
    } catch (err) {
      console.error('Failed to fetch tasks', err);
      // Mock data for demo
      setTasks([
        { id: '1', title: 'Document Analysis', status: 'running', progress: 65, agentName: 'Analyst Agent', createdAt: new Date() },
        { id: '2', title: 'Code Review', status: 'queued', progress: 0, agentName: 'Code Agent', createdAt: new Date() },
        { id: '3', title: 'Data Processing', status: 'completed', progress: 100, agentName: 'Data Agent', createdAt: new Date() },
        { id: '4', title: 'Report Generation', status: 'failed', progress: 45, agentName: 'Report Agent', createdAt: new Date(), error: 'Timeout' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchTasks(); 
    fetchAgents();
    fetchAccessControlData();
  }, [refreshKey]);

  const resetAccessControl = () => {
    setSelectedUsers([]);
    setSelectedGroups([]);
    setSelectedPermissions([]);
    setAccessControlExpanded(false);
    setAccessSearchQuery('');
    setAccessTab('users');
  };

  const handleCreateTask = async () => {
    if (!newTask.prompt.trim() || !newTask.agentId) return;
    
    try {
      setCreating(true);
      const accessControl: TaskAccessControl = {};
      if (selectedUsers.length > 0) accessControl.allowedUserIds = selectedUsers;
      if (selectedGroups.length > 0) accessControl.allowedGroupIds = selectedGroups;
      if (selectedPermissions.length > 0) accessControl.requiredPermissions = selectedPermissions;

      await tasksService.create({
        prompt: newTask.prompt,
        agentId: newTask.agentId,
        accessControl: Object.keys(accessControl).length > 0 ? accessControl : undefined,
      });
      setShowCreateModal(false);
      setNewTask({ prompt: '', agentId: '' });
      resetAccessControl();
      fetchTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
      alert('Failed to create task. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenManageAccess = (task: Task) => {
    setManageAccessTask(task);
    setSelectedUsers(task.accessControl?.allowedUserIds || []);
    setSelectedGroups(task.accessControl?.allowedGroupIds || []);
    setSelectedPermissions(task.accessControl?.requiredPermissions || []);
    setAccessSearchQuery('');
    setAccessTab('users');
  };

  const handleSaveAccess = async () => {
    if (!manageAccessTask) return;
    
    try {
      setSavingAccess(true);
      const accessControl: TaskAccessControl = {
        allowedUserIds: selectedUsers.length > 0 ? selectedUsers : undefined,
        allowedGroupIds: selectedGroups.length > 0 ? selectedGroups : undefined,
        requiredPermissions: selectedPermissions.length > 0 ? selectedPermissions : undefined,
      };
      await tasksService.updateAccessControl(manageAccessTask.id, accessControl);
      setManageAccessTask(null);
      resetAccessControl();
      fetchTasks();
    } catch (err) {
      console.error('Failed to update access control:', err);
      alert('Failed to update access control. Please try again.');
    } finally {
      setSavingAccess(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(accessSearchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(accessSearchQuery.toLowerCase())
  );

  const filteredPermissions = permissions.filter((p) =>
    p.name.toLowerCase().includes(accessSearchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(accessSearchQuery.toLowerCase())
  );

  const getAccessControlSummary = () => {
    const parts: string[] = [];
    if (selectedUsers.length > 0) parts.push(`${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''}`);
    if (selectedGroups.length > 0) parts.push(`${selectedGroups.length} group${selectedGroups.length !== 1 ? 's' : ''}`);
    if (selectedPermissions.length > 0) parts.push(`${selectedPermissions.length} permission${selectedPermissions.length !== 1 ? 's' : ''}`);
    return parts.length > 0 ? parts.join(', ') : 'No restrictions';
  };

  const handleDeleteTask = async () => {
    if (!deleteTask) return;
    
    try {
      setDeleting(true);
      await tasksService.delete(deleteTask.id);
      setDeleteTask(null);
      fetchTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
      alert('Failed to delete task. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const stats = {
    running: tasks.filter(t => t.status === 'running').length,
    queued: tasks.filter(t => t.status === 'queued' || t.status === 'pending').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed' || t.status === 'cancelled').length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <PlayArrowIcon />;
      case 'queued': return <AccessTimeIcon />;
      case 'completed': return <CheckCircleIcon />;
      case 'failed': return <ErrorIcon />;
      default: return <AccessTimeIcon />;
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h1>AI Tasks</h1>
          <p>Monitor and manage agent task execution</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.filterBtn}>
            <FilterListIcon /> Filter
          </button>
          <button className={styles.createBtn} onClick={() => setShowCreateModal(true)}>
            <AddIcon /> New Task
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.running}`}>
          <div className={styles.statCardContent}>
            <div className={`${styles.statIcon} ${styles.running}`}>
              <PlayArrowIcon />
            </div>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>Running</div>
              <div className={styles.statValue}>{stats.running}</div>
            </div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.queued}`}>
          <div className={styles.statCardContent}>
            <div className={`${styles.statIcon} ${styles.queued}`}>
              <AccessTimeIcon />
            </div>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>Queued</div>
              <div className={styles.statValue}>{stats.queued}</div>
            </div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.completed}`}>
          <div className={styles.statCardContent}>
            <div className={`${styles.statIcon} ${styles.completed}`}>
              <CheckCircleIcon />
            </div>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>Completed</div>
              <div className={styles.statValue}>{stats.completed}</div>
            </div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.failed}`}>
          <div className={styles.statCardContent}>
            <div className={`${styles.statIcon} ${styles.failed}`}>
              <ErrorIcon />
            </div>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>Failed</div>
              <div className={styles.statValue}>{stats.failed}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tasks Container */}
      <div className={styles.tasksContainer}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            <AssignmentIcon /> All Tasks
          </h3>
          <div className={styles.viewToggle}>
            <button 
              className={`${styles.viewBtn} ${view === 'list' ? styles.active : ''}`}
              onClick={() => setView('list')}
            >
              <ViewListIcon />
            </button>
            <button 
              className={`${styles.viewBtn} ${view === 'grid' ? styles.active : ''}`}
              onClick={() => setView('grid')}
            >
              <GridViewIcon />
            </button>
          </div>
        </div>

        {loading ? (
          <div className={styles.tasksList}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={`${styles.skeleton} ${styles.skeletonStatus}`} />
                <div className={styles.skeletonInfo}>
                  <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
                  <div className={`${styles.skeleton} ${styles.skeletonMeta}`} />
                </div>
                <div className={`${styles.skeleton} ${styles.skeletonAgent}`} />
                <div className={`${styles.skeleton} ${styles.skeletonProgress}`} />
                <div className={styles.skeletonActions}>
                  <div className={`${styles.skeleton} ${styles.skeletonBtn}`} />
                  <div className={`${styles.skeleton} ${styles.skeletonBtn}`} />
                </div>
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <AssignmentIcon />
            </div>
            <h3>No tasks yet</h3>
            <p>Create your first task to start AI-powered automation</p>
            <button className={styles.emptyBtn} onClick={() => setShowCreateModal(true)}>
              <AddIcon /> Create Task
            </button>
          </div>
        ) : (
          <div className={view === 'grid' ? styles.tasksGrid : styles.tasksList}>
            {tasks.map(task => {
              const displayStatus = getDisplayStatus(task.status);
              const progress = getTaskProgress(task);
              return (
                <div key={task.id} className={`${styles.taskCard} ${styles[displayStatus]}`}>
                  <div className={`${styles.taskStatus} ${styles[displayStatus]}`}>
                    {getStatusIcon(displayStatus)}
                  </div>
                  
                  <div className={styles.taskInfo}>
                    <div className={styles.taskTitle}>{getTaskTitle(task)}</div>
                    <div className={styles.taskMeta}>
                      <span>
                        <AccessTimeIcon /> {new Date(task.createdAt).toLocaleTimeString()}
                      </span>
                      {task.error && (
                        <span className={styles.errorText}>
                          <ErrorIcon /> {task.error}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.taskAgent}>
                    <div className={styles.taskAgentIcon}>
                      <SmartToyIcon />
                    </div>
                    <span className={styles.taskAgentName}>{task.agentName || 'Unassigned'}</span>
                  </div>

                  <div className={styles.taskProgress}>
                    <div className={styles.progressLabel}>
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className={styles.progressBar}>
                      <div 
                        className={`${styles.progressFill} ${styles[displayStatus]}`} 
                        style={{ width: `${progress}%` }} 
                      />
                    </div>
                  </div>

                  <div className={styles.taskActions}>
                    {(displayStatus === 'running' || displayStatus === 'queued') && (
                      <button 
                        className={`${styles.taskActionBtn} ${styles.access}`} 
                        title="Manage Access"
                        onClick={() => handleOpenManageAccess(task)}
                      >
                        <SecurityIcon />
                      </button>
                    )}
                    {displayStatus === 'running' && (
                      <button className={`${styles.taskActionBtn} ${styles.stop}`} title="Stop">
                        <StopIcon />
                      </button>
                    )}
                    {displayStatus === 'queued' && (
                      <button className={styles.taskActionBtn} title="Start now">
                        <PlayArrowIcon />
                      </button>
                    )}
                    {displayStatus === 'failed' && (
                      <button className={`${styles.taskActionBtn} ${styles.retry}`} title="Retry">
                        <RefreshIcon />
                      </button>
                    )}
                    <button 
                      className={`${styles.taskActionBtn} ${styles.delete}`} 
                      title="Delete task"
                      onClick={() => setDeleteTask(task)}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={() => { setShowCreateModal(false); resetAccessControl(); }}>
          <div className={styles.modalLarge} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Create New Task</h2>
              <button className={styles.modalClose} onClick={() => { setShowCreateModal(false); resetAccessControl(); }}>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Agent *</label>
                <div className={styles.customDropdown} ref={dropdownRef}>
                  <button 
                    type="button"
                    className={`${styles.dropdownTrigger} ${agentDropdownOpen ? styles.open : ''}`}
                    onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
                  >
                    <span className={styles.dropdownValue}>
                      {newTask.agentId ? (
                        <>
                          <SmartToyIcon style={{ fontSize: 16 }} />
                          {agents.find(a => a.id === newTask.agentId)?.name || 'Unknown Agent'}
                        </>
                      ) : (
                        <span className={styles.dropdownPlaceholder}>Select an agent...</span>
                      )}
                    </span>
                    <span className={`${styles.dropdownArrow} ${agentDropdownOpen ? styles.open : ''}`}>
                      &#9660;
                    </span>
                  </button>
                  {agentDropdownOpen && (
                    <div className={styles.dropdownMenu}>
                      <div className={styles.dropdownHeader}>
                        <SmartToyIcon style={{ fontSize: 14 }} />
                        <span>Available Agents</span>
                      </div>
                      <div className={styles.dropdownList}>
                        {agents.length === 0 ? (
                          <div className={styles.dropdownEmpty}>
                            No agents available. Create an agent first.
                          </div>
                        ) : (
                          agents.map((agent) => (
                            <button
                              key={agent.id}
                              type="button"
                              className={`${styles.dropdownItem} ${newTask.agentId === agent.id ? styles.selected : ''}`}
                              onClick={() => {
                                setNewTask({ ...newTask, agentId: agent.id });
                                setAgentDropdownOpen(false);
                              }}
                            >
                              <div className={styles.dropdownItemIcon}>
                                <SmartToyIcon style={{ fontSize: 18 }} />
                              </div>
                              <div className={styles.dropdownItemContent}>
                                <span className={styles.dropdownItemName}>{agent.name}</span>
                                <span className={styles.dropdownItemStatus}>{agent.status}</span>
                              </div>
                              {newTask.agentId === agent.id && (
                                <span className={styles.dropdownItemCheck}>&#10003;</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Prompt *</label>
                <textarea
                  value={newTask.prompt}
                  onChange={(e) => setNewTask({ ...newTask, prompt: e.target.value })}
                  placeholder="What would you like the AI to do?"
                  rows={4}
                />
              </div>

              {/* Access Control Section */}
              <div className={styles.accessControlSection}>
                <button 
                  type="button"
                  className={styles.accessControlToggle}
                  onClick={() => setAccessControlExpanded(!accessControlExpanded)}
                >
                  <div className={styles.accessControlToggleLeft}>
                    <SecurityIcon />
                    <div>
                      <span className={styles.accessControlTitle}>Access Control</span>
                      <span className={styles.accessControlSummary}>{getAccessControlSummary()}</span>
                    </div>
                  </div>
                  {accessControlExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </button>

                {accessControlExpanded && (
                  <div className={styles.accessControlContent}>
                    <div className={styles.accessControlTabs}>
                      <button
                        type="button"
                        className={`${styles.accessTab} ${accessTab === 'users' ? styles.active : ''}`}
                        onClick={() => setAccessTab('users')}
                      >
                        <PersonIcon /> Users ({selectedUsers.length})
                      </button>
                      <button
                        type="button"
                        className={`${styles.accessTab} ${accessTab === 'groups' ? styles.active : ''}`}
                        onClick={() => setAccessTab('groups')}
                      >
                        <GroupIcon /> Groups ({selectedGroups.length})
                      </button>
                      <button
                        type="button"
                        className={`${styles.accessTab} ${accessTab === 'permissions' ? styles.active : ''}`}
                        onClick={() => setAccessTab('permissions')}
                      >
                        <LockIcon /> Permissions ({selectedPermissions.length})
                      </button>
                    </div>

                    <div className={styles.accessSearchRow}>
                      <SearchIcon />
                      <input
                        type="text"
                        placeholder={`Search ${accessTab}...`}
                        value={accessSearchQuery}
                        onChange={(e) => setAccessSearchQuery(e.target.value)}
                      />
                    </div>

                    <div className={styles.accessItemsList}>
                      {accessTab === 'users' && (
                        filteredUsers.length === 0 ? (
                          <div className={styles.accessEmpty}>No users found</div>
                        ) : (
                          filteredUsers.map((user) => (
                            <div
                              key={user.id}
                              className={`${styles.accessItem} ${selectedUsers.includes(user.id) ? styles.selected : ''}`}
                              onClick={() => setSelectedUsers((prev) =>
                                prev.includes(user.id) ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                              )}
                            >
                              <div className={styles.accessItemIcon}>
                                <PersonIcon />
                              </div>
                              <div className={styles.accessItemInfo}>
                                <span className={styles.accessItemName}>{user.email.split('@')[0]}</span>
                                <span className={styles.accessItemDetail}>{user.email}</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={selectedUsers.includes(user.id)}
                                readOnly
                                className={styles.accessCheckbox}
                              />
                            </div>
                          ))
                        )
                      )}

                      {accessTab === 'groups' && (
                        filteredGroups.length === 0 ? (
                          <div className={styles.accessEmpty}>No groups found</div>
                        ) : (
                          filteredGroups.map((group) => (
                            <div
                              key={group.id}
                              className={`${styles.accessItem} ${selectedGroups.includes(group.id) ? styles.selected : ''}`}
                              onClick={() => setSelectedGroups((prev) =>
                                prev.includes(group.id) ? prev.filter((id) => id !== group.id) : [...prev, group.id]
                              )}
                            >
                              <div className={styles.accessItemIcon} style={{ backgroundColor: `${group.color || '#6366f1'}20`, color: group.color || '#6366f1' }}>
                                <GroupIcon />
                              </div>
                              <div className={styles.accessItemInfo}>
                                <span className={styles.accessItemName}>{group.name}</span>
                                <span className={styles.accessItemDetail}>{group.permissions?.length || 0} permissions</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={selectedGroups.includes(group.id)}
                                readOnly
                                className={styles.accessCheckbox}
                              />
                            </div>
                          ))
                        )
                      )}

                      {accessTab === 'permissions' && (
                        filteredPermissions.length === 0 ? (
                          <div className={styles.accessEmpty}>No permissions found</div>
                        ) : (
                          filteredPermissions.map((perm) => (
                            <div
                              key={perm.id}
                              className={`${styles.accessItem} ${selectedPermissions.includes(perm.id) ? styles.selected : ''}`}
                              onClick={() => setSelectedPermissions((prev) =>
                                prev.includes(perm.id) ? prev.filter((id) => id !== perm.id) : [...prev, perm.id]
                              )}
                            >
                              <div className={styles.accessItemIcon}>
                                <LockIcon />
                              </div>
                              <div className={styles.accessItemInfo}>
                                <span className={styles.accessItemName}>{perm.name}</span>
                                <span className={styles.accessItemDetail}>{perm.code}</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={selectedPermissions.includes(perm.id)}
                                readOnly
                                className={styles.accessCheckbox}
                              />
                            </div>
                          ))
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => { setShowCreateModal(false); resetAccessControl(); }}>
                Cancel
              </button>
              <button 
                className={styles.submitBtn} 
                onClick={handleCreateTask}
                disabled={creating || !newTask.prompt.trim() || !newTask.agentId}
              >
                {creating ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Task Confirmation Modal */}
      {deleteTask && (
        <div className={styles.modalOverlay} onClick={() => setDeleteTask(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Delete Task</h2>
              <button className={styles.modalClose} onClick={() => setDeleteTask(null)}>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Are you sure you want to delete this task?
              </p>
              <div className={styles.deleteTaskInfo}>
                <strong>{getTaskTitle(deleteTask)}</strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>
                  Status: {deleteTask.status} | Created: {new Date(deleteTask.createdAt).toLocaleString()}
                </span>
              </div>
              <p style={{ color: 'var(--cyber-magenta)', fontSize: '13px', marginTop: '16px' }}>
                This action cannot be undone.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setDeleteTask(null)}>
                Cancel
              </button>
              <button 
                className={styles.deleteBtn} 
                onClick={handleDeleteTask}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Access Modal */}
      {manageAccessTask && (
        <div className={styles.modalOverlay} onClick={() => { setManageAccessTask(null); resetAccessControl(); }}>
          <div className={styles.modalLarge} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>
                <SecurityIcon style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Manage Task Access
              </h2>
              <button className={styles.modalClose} onClick={() => { setManageAccessTask(null); resetAccessControl(); }}>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.manageAccessTaskInfo}>
                <span className={styles.manageAccessLabel}>Task:</span>
                <span className={styles.manageAccessTitle}>{getTaskTitle(manageAccessTask)}</span>
                <span className={`${styles.manageAccessStatus} ${styles[manageAccessTask.status]}`}>
                  {manageAccessTask.status}
                </span>
              </div>

              <div className={styles.accessControlContentFull}>
                <div className={styles.accessControlTabs}>
                  <button
                    type="button"
                    className={`${styles.accessTab} ${accessTab === 'users' ? styles.active : ''}`}
                    onClick={() => setAccessTab('users')}
                  >
                    <PersonIcon /> Users ({selectedUsers.length})
                  </button>
                  <button
                    type="button"
                    className={`${styles.accessTab} ${accessTab === 'groups' ? styles.active : ''}`}
                    onClick={() => setAccessTab('groups')}
                  >
                    <GroupIcon /> Groups ({selectedGroups.length})
                  </button>
                  <button
                    type="button"
                    className={`${styles.accessTab} ${accessTab === 'permissions' ? styles.active : ''}`}
                    onClick={() => setAccessTab('permissions')}
                  >
                    <LockIcon /> Permissions ({selectedPermissions.length})
                  </button>
                </div>

                <div className={styles.accessSearchRow}>
                  <SearchIcon />
                  <input
                    type="text"
                    placeholder={`Search ${accessTab}...`}
                    value={accessSearchQuery}
                    onChange={(e) => setAccessSearchQuery(e.target.value)}
                  />
                </div>

                <div className={styles.accessItemsListLarge}>
                  {accessTab === 'users' && (
                    filteredUsers.length === 0 ? (
                      <div className={styles.accessEmpty}>No users found</div>
                    ) : (
                      filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          className={`${styles.accessItem} ${selectedUsers.includes(user.id) ? styles.selected : ''}`}
                          onClick={() => setSelectedUsers((prev) =>
                            prev.includes(user.id) ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                          )}
                        >
                          <div className={styles.accessItemIcon}>
                            <PersonIcon />
                          </div>
                          <div className={styles.accessItemInfo}>
                            <span className={styles.accessItemName}>{user.email.split('@')[0]}</span>
                            <span className={styles.accessItemDetail}>{user.email}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            readOnly
                            className={styles.accessCheckbox}
                          />
                        </div>
                      ))
                    )
                  )}

                  {accessTab === 'groups' && (
                    filteredGroups.length === 0 ? (
                      <div className={styles.accessEmpty}>No groups found</div>
                    ) : (
                      filteredGroups.map((group) => (
                        <div
                          key={group.id}
                          className={`${styles.accessItem} ${selectedGroups.includes(group.id) ? styles.selected : ''}`}
                          onClick={() => setSelectedGroups((prev) =>
                            prev.includes(group.id) ? prev.filter((id) => id !== group.id) : [...prev, group.id]
                          )}
                        >
                          <div className={styles.accessItemIcon} style={{ backgroundColor: `${group.color || '#6366f1'}20`, color: group.color || '#6366f1' }}>
                            <GroupIcon />
                          </div>
                          <div className={styles.accessItemInfo}>
                            <span className={styles.accessItemName}>{group.name}</span>
                            <span className={styles.accessItemDetail}>{group.permissions?.length || 0} permissions</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedGroups.includes(group.id)}
                            readOnly
                            className={styles.accessCheckbox}
                          />
                        </div>
                      ))
                    )
                  )}

                  {accessTab === 'permissions' && (
                    filteredPermissions.length === 0 ? (
                      <div className={styles.accessEmpty}>No permissions found</div>
                    ) : (
                      filteredPermissions.map((perm) => (
                        <div
                          key={perm.id}
                          className={`${styles.accessItem} ${selectedPermissions.includes(perm.id) ? styles.selected : ''}`}
                          onClick={() => setSelectedPermissions((prev) =>
                            prev.includes(perm.id) ? prev.filter((id) => id !== perm.id) : [...prev, perm.id]
                          )}
                        >
                          <div className={styles.accessItemIcon}>
                            <LockIcon />
                          </div>
                          <div className={styles.accessItemInfo}>
                            <span className={styles.accessItemName}>{perm.name}</span>
                            <span className={styles.accessItemDetail}>{perm.code}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(perm.id)}
                            readOnly
                            className={styles.accessCheckbox}
                          />
                        </div>
                      ))
                    )
                  )}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => { setManageAccessTask(null); resetAccessControl(); }}>
                Cancel
              </button>
              <button 
                className={styles.submitBtn} 
                onClick={handleSaveAccess}
                disabled={savingAccess}
              >
                {savingAccess ? 'Saving...' : 'Save Access Control'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

