/**
 * Theme Customizer Component
 * Allows users to customize the app's appearance
 */
import { useEffect } from 'react';
import {
  useTheme,
  themeColors,
  ThemeColorKey,
} from '../../contexts/ThemeContext';
import { startOnboardingTour } from '../OnboardingTour';
import './ThemeCustomizer.css';

interface ThemeCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
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

export function ThemeCustomizer({ isOpen, onClose }: ThemeCustomizerProps) {
  const { mode, toggleMode, colorKey, setColorKey } = useTheme();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="theme-customizer-overlay" onClick={onClose}>
      <div className="theme-customizer" onClick={(e) => e.stopPropagation()}>
        <div className="customizer-header">
          <h2>Customize Appearance</h2>
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
        </div>

        <div className="customizer-content">
          {/* Mode Toggle */}
          <div className="customizer-section">
            <h3>Theme Mode</h3>
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
          <div className="customizer-section">
            <h3>Accent Color</h3>
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
          <div className="customizer-section">
            <h3>Preview</h3>
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
          <div className="customizer-section">
            <h3>Onboarding</h3>
            <button
              className="tour-btn"
              onClick={() => {
                startOnboardingTour();
                onClose();
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
