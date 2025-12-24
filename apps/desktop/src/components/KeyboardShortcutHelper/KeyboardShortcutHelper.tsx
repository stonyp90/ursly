/**
 * KeyboardShortcutHelper - Linear-style keyboard shortcut helper
 *
 * Shows available keyboard shortcuts in a clean, discoverable panel.
 * Can be toggled with ? or accessed from the help menu.
 */

import { useState, useEffect } from 'react';
import './KeyboardShortcutHelper.css';

interface ShortcutCategory {
  name: string;
  shortcuts: Shortcut[];
}

interface Shortcut {
  keys: string[];
  description: string;
}

// Platform detection
const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? '⌘' : 'Ctrl';

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    name: 'Navigation',
    shortcuts: [
      { keys: [modKey, '['], description: 'Go back' },
      { keys: [modKey, ']'], description: 'Go forward' },
      { keys: [modKey, '↑'], description: 'Go to parent folder' },
      { keys: ['Enter'], description: 'Open selected item' },
      { keys: ['↑', '↓', '←', '→'], description: 'Navigate files' },
    ],
  },
  {
    name: 'Selection',
    shortcuts: [
      { keys: [modKey, 'A'], description: 'Select all' },
      { keys: [modKey, 'Click'], description: 'Toggle selection' },
      { keys: ['Shift', 'Click'], description: 'Range select' },
      { keys: ['Escape'], description: 'Clear selection / Cancel' },
    ],
  },
  {
    name: 'Clipboard',
    shortcuts: [
      { keys: [modKey, 'C'], description: 'Copy' },
      { keys: [modKey, 'X'], description: 'Cut' },
      { keys: [modKey, 'V'], description: 'Paste' },
      { keys: [modKey, 'D'], description: 'Duplicate' },
    ],
  },
  {
    name: 'File Operations',
    shortcuts: [
      { keys: [modKey, 'Shift', 'N'], description: 'New folder' },
      { keys: ['Enter'], description: 'Rename' },
      { keys: [modKey, 'Delete'], description: 'Move to Trash' },
      { keys: ['Delete'], description: 'Delete' },
    ],
  },
  {
    name: 'View',
    shortcuts: [
      { keys: [modKey, '1'], description: 'Icon view' },
      { keys: [modKey, '2'], description: 'List view' },
      { keys: [modKey, 'I'], description: 'Get info' },
      { keys: [modKey, 'Shift', '.'], description: 'Toggle hidden files' },
    ],
  },
  {
    name: 'Search & Filter',
    shortcuts: [
      { keys: [modKey, 'F'], description: 'Search' },
      { keys: ['Escape'], description: 'Clear search' },
    ],
  },
];

interface KeyboardShortcutHelperProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutHelper({
  isOpen,
  onClose,
}: KeyboardShortcutHelperProps) {
  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="shortcut-overlay" onClick={onClose}>
      <div className="shortcut-panel" onClick={(e) => e.stopPropagation()}>
        <div className="shortcut-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="shortcut-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
            </svg>
          </button>
        </div>

        <div className="shortcut-content">
          {SHORTCUT_CATEGORIES.map((category) => (
            <div key={category.name} className="shortcut-category">
              <h3 className="category-title">{category.name}</h3>
              <div className="shortcut-list">
                {category.shortcuts.map((shortcut, index) => (
                  <div key={index} className="shortcut-item">
                    <span className="shortcut-description">
                      {shortcut.description}
                    </span>
                    <span className="shortcut-keys">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex}>
                          <kbd className="key">{key}</kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="key-separator">+</span>
                          )}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shortcut-footer">
          <span className="footer-hint">
            Press <kbd className="key">?</kbd> to toggle this panel
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage keyboard shortcut helper visibility
 */
export function useKeyboardShortcutHelper() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle with ? key (Shift+/)
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}

export default KeyboardShortcutHelper;
