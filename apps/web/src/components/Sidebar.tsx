import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from '../contexts';
import './Sidebar.css';

// Check if running in Tauri Agent Desktop (should hide Storage section)
function useIsAgentDesktop(): boolean {
  const [isAgent, setIsAgent] = useState(false);

  useEffect(() => {
    const checkAgentDesktop = async () => {
      // Check if running in Tauri
      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
      if (!isTauri) return;

      try {
        // Try to get the window label from Tauri
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const label = win.label;

        // Agent Desktop uses "main" window but we can check the app name
        // by trying to invoke a command that only exists in Agent Desktop
        // For now, check if we're NOT in VFS by checking for vfs_init command
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('vfs_list_sources');
          // If vfs_list_sources exists, we're in VFS Desktop, not Agent
          setIsAgent(false);
        } catch {
          // vfs_list_sources doesn't exist, we're in Agent Desktop
          setIsAgent(true);
        }
      } catch {
        // Fallback: check document title
        const title = document.title.toLowerCase();
        setIsAgent(title.includes('agent'));
      }
    };

    checkAgentDesktop();
  }, []);

  return isAgent;
}

const mainMenuItems = [
  { path: '/', label: 'Dashboard', icon: 'dashboard' },
  { path: '/agents', label: 'Agents', icon: 'agents' },
  { path: '/models', label: 'Models', icon: 'models' },
  { path: '/tasks', label: 'Tasks', icon: 'tasks' },
];

const storageMenuItems = [
  { path: '/storage', label: 'File System', icon: 'filesystem' },
];

// Metrics section - only available in Tauri desktop app
const metricsMenuItems = [
  { path: '/metrics/gpu', label: 'GPU Metrics', icon: 'gpu' },
  {
    path: '/metrics/timeline',
    label: 'Performance Timeline',
    icon: 'timeline',
  },
  { path: '/metrics/system', label: 'System Resources', icon: 'system' },
];

const accessControlItems = [
  { path: '/permissions', label: 'Permissions', icon: 'permissions' },
  { path: '/groups', label: 'Groups', icon: 'groups' },
  { path: '/users', label: 'Users', icon: 'users' },
];

const systemMenuItems = [
  { path: '/audit', label: 'Audit Logs', icon: 'audit' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

const icons: Record<string, JSX.Element> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  agents: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="5" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2" />
    </svg>
  ),
  models: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  tasks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  permissions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  groups: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  gpu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="2" x2="9" y2="4" />
      <line x1="15" y1="2" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="22" />
      <line x1="15" y1="20" x2="15" y2="22" />
      <line x1="2" y1="9" x2="4" y2="9" />
      <line x1="2" y1="15" x2="4" y2="15" />
      <line x1="20" y1="9" x2="22" y2="9" />
      <line x1="20" y1="15" x2="22" y2="15" />
    </svg>
  ),
  timeline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  system: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  metrics: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  ),
  filesystem: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  ),
};

export function Sidebar() {
  const location = useLocation();
  const { currentOrg } = useUser();
  const isAgentDesktop = useIsAgentDesktop();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <span className="logo-letter">U</span>
          </div>
          <div className="logo-text">
            <span className="logo-brand">URSLY</span>
            <span className="logo-subtitle">
              {currentOrg?.name || 'Ursly.io'}
            </span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <span className="nav-section-title">Main</span>
          {mainMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="sidebar-icon">{icons[item.icon]}</span>
              <span className="sidebar-label">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Storage section - hidden in Agent Desktop (VFS has its own file browser) */}
        {!isAgentDesktop && (
          <div className="nav-section">
            <span className="nav-section-title">Storage</span>
            {storageMenuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-item ${location.pathname === item.path || location.pathname.startsWith(item.path) ? 'active' : ''}`}
              >
                <span className="sidebar-icon">{icons[item.icon]}</span>
                <span className="sidebar-label">{item.label}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Metrics section */}
        <div className="nav-section">
          <span className="nav-section-title">Metrics</span>
          {metricsMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-item ${location.pathname === item.path || location.pathname.startsWith(item.path) ? 'active' : ''}`}
            >
              <span className="sidebar-icon">{icons[item.icon]}</span>
              <span className="sidebar-label">{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="nav-section">
          <span className="nav-section-title">Access Control</span>
          {accessControlItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="sidebar-icon">{icons[item.icon]}</span>
              <span className="sidebar-label">{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="nav-section">
          <span className="nav-section-title">System</span>
          {systemMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="sidebar-icon">{icons[item.icon]}</span>
              <span className="sidebar-label">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-version">
          <span>v1.0.0</span>
          <span className="version-badge">Beta</span>
        </div>
      </div>
    </aside>
  );
}
