/**
 * BottomToolbar - Clean floating action bar
 * Inspired by Linear, Raycast, and Arc browser
 */
import { KeyboardShortcutHelper } from '../KeyboardShortcutHelper';
import './BottomToolbar.css';

interface BottomToolbarProps {
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  isShortcutsOpen: boolean;
  onCloseShortcuts: () => void;
}

export function BottomToolbar({
  onOpenSettings,
  onOpenShortcuts,
  isShortcutsOpen,
  onCloseShortcuts,
}: BottomToolbarProps) {
  return (
    <>
      <div className="bottom-toolbar">
        <button
          className="action-pill shortcuts"
          onClick={onOpenShortcuts}
          title="Keyboard Shortcuts (Press ?)"
        >
          <div className="pill-glow" />
          <svg
            className="pill-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="2" y="4" width="20" height="16" rx="3" />
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M8 12h.01M12 12h.01M16 12h.01" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="7" y1="16" x2="17" y2="16" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="pill-label">Shortcuts</span>
        </button>

        <div className="action-divider" />

        <button
          className="action-pill settings"
          onClick={onOpenSettings}
          title="Appearance Settings"
        >
          <div className="pill-glow" />
          <svg
            className="pill-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          <span className="pill-label">Theme</span>
        </button>
      </div>

      <KeyboardShortcutHelper isOpen={isShortcutsOpen} onClose={onCloseShortcuts} />
    </>
  );
}

export default BottomToolbar;
