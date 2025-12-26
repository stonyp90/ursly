/**
 * SettingsPage - Full-page settings view
 * Displays theme customization and app settings
 */
import { useEffect } from 'react';
import { useTheme, themeColors, ThemeColorKey } from '../contexts/ThemeContext';
import { startOnboardingTour } from '../components/OnboardingTour';
import './SettingsPage.css';

interface SettingsPageProps {
  onClose?: () => void;
}

const colorDisplayNames: Record<ThemeColorKey, string> = {
  cyan: 'Cyan',
  purple: 'Purple',
  neonCyan: 'Neon Cyan',
  neonMagenta: 'Neon Magenta',
  electricPurple: 'Electric Purple',
  neonGreen: 'Neon Green',
  sunsetOrange: 'Sunset Orange',
  electricBlue: 'Electric Blue',
  cyberYellow: 'Cyber Yellow',
  neonRed: 'Neon Red',
};

export function SettingsPage({ onClose }: SettingsPageProps) {
  const { mode, toggleMode, colorKey, setColorKey } = useTheme();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="settings-page">
      <div className="settings-container">
        <div className="settings-header">
          <h1>Settings</h1>
          {onClose && (
            <button className="close-btn" onClick={onClose}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="settings-content">
          {/* Mode Toggle */}
          <div className="settings-section">
            <h2>Theme Mode</h2>
            <div className="mode-toggle">
              <button
                className={`mode-btn ${mode === 'dark' ? 'active' : ''}`}
                onClick={() => mode !== 'dark' && toggleMode()}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                <span>Dark</span>
              </button>
              <button
                className={`mode-btn ${mode === 'light' ? 'active' : ''}`}
                onClick={() => mode !== 'light' && toggleMode()}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
                <span>Light</span>
              </button>
            </div>
          </div>

          {/* Accent Colors */}
          <div className="settings-section">
            <h2>Accent Color</h2>
            <div className="color-grid">
              {(Object.keys(themeColors) as ThemeColorKey[]).map((key) => (
                <button
                  key={key}
                  className={`color-swatch ${colorKey === key ? 'active' : ''}`}
                  onClick={() => setColorKey(key)}
                  style={
                    {
                      '--swatch-color': themeColors[key].primary,
                      '--swatch-secondary': themeColors[key].secondary,
                    } as React.CSSProperties
                  }
                  title={colorDisplayNames[key]}
                >
                  <div className="swatch-inner" />
                  {colorKey === key && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="check-icon"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <p className="selected-color">{colorDisplayNames[colorKey]}</p>
          </div>

          {/* Preview */}
          <div className="settings-section">
            <h2>Preview</h2>
            <div className="theme-preview">
              <div className="preview-sidebar">
                <div className="preview-item active" />
                <div className="preview-item" />
                <div className="preview-item" />
              </div>
              <div className="preview-content">
                <div className="preview-toolbar" />
                <div className="preview-grid">
                  <div className="preview-file" />
                  <div className="preview-file selected" />
                  <div className="preview-file" />
                  <div className="preview-file" />
                </div>
              </div>
            </div>
          </div>

          {/* Onboarding Tour */}
          <div className="settings-section">
            <h2>Onboarding</h2>
            <button
              className="tour-btn"
              onClick={() => {
                startOnboardingTour();
                if (onClose) onClose();
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span>Start Feature Tour</span>
            </button>
            <p className="tour-description">
              Take a quick tour to learn about Ursly VFS features and keyboard
              shortcuts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
