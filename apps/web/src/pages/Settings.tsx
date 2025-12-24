import { useState } from 'react';
import { useTheme, themeColors, ThemeColorKey } from '../contexts';
import { useUser } from '../contexts';
import './Settings.css';

export function Settings() {
  const { mode, setMode, colorKey, setColorKey } = useTheme();
  const { currentOrg } = useUser();
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    inApp: true,
    digest: 'daily' as 'realtime' | 'daily' | 'weekly' | 'never',
  });

  const colorOptions = Object.entries(themeColors) as [ThemeColorKey, typeof themeColors[ThemeColorKey]][];

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">Customize your workspace and preferences</p>
      </div>

      <div className="settings-grid">
        {/* Appearance */}
        <div className="settings-card">
          <div className="card-header">
            <div className="card-header-icon appearance">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            </div>
            <div>
              <h2>Appearance</h2>
              <p>Customize the look and feel of your workspace</p>
            </div>
          </div>

          <div className="settings-section">
            <h3>Theme Mode</h3>
            <p className="section-desc">Choose between light and dark mode</p>
            <div className="mode-toggle">
              <button
                className={`mode-option ${mode === 'light' ? 'active' : ''}`}
                onClick={() => setMode('light')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                <span>Light</span>
              </button>
              <button
                className={`mode-option ${mode === 'dark' ? 'active' : ''}`}
                onClick={() => setMode('dark')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                <span>Dark</span>
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h3>Accent Color</h3>
            <p className="section-desc">Choose your preferred accent color</p>
            <div className="color-grid">
              {colorOptions.map(([key, theme]) => (
                <button
                  key={key}
                  className={`color-option ${colorKey === key ? 'active' : ''}`}
                  onClick={() => setColorKey(key)}
                  style={{
                    '--option-primary': theme.primary,
                    '--option-secondary': theme.secondary,
                  } as React.CSSProperties}
                >
                  <div className="color-swatch" />
                  <span>{theme.name}</span>
                  {colorKey === key && (
                    <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <h3>Preview</h3>
            <div className="theme-preview">
              <div className="preview-card">
                <div className="preview-header">
                  <div className="preview-dot" />
                  <span>Agent Status</span>
                </div>
                <div className="preview-content">
                  <div className="preview-bar" style={{ width: '75%' }} />
                  <div className="preview-bar secondary" style={{ width: '50%' }} />
                </div>
                <button className="preview-btn">Action Button</button>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="settings-card">
          <div className="card-header">
            <div className="card-header-icon notifications">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div>
              <h2>Notifications</h2>
              <p>Manage how you receive updates</p>
            </div>
          </div>

          <div className="settings-section">
            <div className="toggle-list">
              <div className="toggle-item">
                <div className="toggle-info">
                  <span className="toggle-title">Email Notifications</span>
                  <span className="toggle-desc">Receive updates via email</span>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={notifications.email}
                    onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="toggle-item">
                <div className="toggle-info">
                  <span className="toggle-title">Push Notifications</span>
                  <span className="toggle-desc">Browser push notifications</span>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={notifications.push}
                    onChange={(e) => setNotifications({ ...notifications, push: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="toggle-item">
                <div className="toggle-info">
                  <span className="toggle-title">In-App Notifications</span>
                  <span className="toggle-desc">Show notifications in the app</span>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={notifications.inApp}
                    onChange={(e) => setNotifications({ ...notifications, inApp: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>Digest Frequency</h3>
            <p className="section-desc">How often to receive summary emails</p>
            <div className="radio-group">
              {(['realtime', 'daily', 'weekly', 'never'] as const).map((option) => (
                <label key={option} className={`radio-option ${notifications.digest === option ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="digest"
                    value={option}
                    checked={notifications.digest === option}
                    onChange={() => setNotifications({ ...notifications, digest: option })}
                  />
                  <span className="radio-indicator" />
                  <span className="radio-label">{option.charAt(0).toUpperCase() + option.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Organization */}
        <div className="settings-card">
          <div className="card-header">
            <div className="card-header-icon org">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <h2>Organization</h2>
              <p>Settings for {currentOrg?.name || 'your organization'}</p>
            </div>
          </div>

          <div className="settings-section">
            <div className="org-info">
              <div className="org-avatar-large">
                {currentOrg?.logoUrl ? (
                  <img src={currentOrg.logoUrl} alt={currentOrg.name} />
                ) : (
                  <span>{currentOrg?.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="org-details">
                <span className="org-name">{currentOrg?.name}</span>
                <span className="org-slug">@{currentOrg?.slug}</span>
                <span className="org-role">
                  <span className="badge badge-secondary">{currentOrg?.role}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <button className="btn-outline full-width">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Manage Organization Settings
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="settings-card danger">
          <div className="card-header">
            <div className="card-header-icon danger">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h2>Danger Zone</h2>
              <p>Irreversible actions</p>
            </div>
          </div>

          <div className="settings-section">
            <div className="danger-actions">
              <div className="danger-item">
                <div>
                  <span className="danger-title">Export Data</span>
                  <span className="danger-desc">Download all your data in JSON format</span>
                </div>
                <button className="btn-outline">Export</button>
              </div>
              <div className="danger-item">
                <div>
                  <span className="danger-title">Delete Account</span>
                  <span className="danger-desc">Permanently delete your account and all data</span>
                </div>
                <button className="btn-danger">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
