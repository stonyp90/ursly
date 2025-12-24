/**
 * ShortcutSettings - Panel for customizing keyboard shortcuts
 *
 * Allows users to view and customize all keyboard shortcuts.
 * Uses global CSS variables for consistent theming.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  useKeyboardShortcuts,
  formatShortcut,
  type ShortcutDefinition,
  type ShortcutCategory,
  type ModifierKey,
} from '../../hooks/useKeyboardShortcuts';
import './ShortcutSettings.css';

interface ShortcutSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'Navigation',
  selection: 'Selection',
  clipboard: 'Clipboard',
  'file-operations': 'File Operations',
  view: 'View',
  search: 'Search',
};

const CATEGORY_ORDER: ShortcutCategory[] = [
  'navigation',
  'selection',
  'clipboard',
  'file-operations',
  'view',
  'search',
];

export function ShortcutSettings({ isOpen, onClose }: ShortcutSettingsProps) {
  const { shortcuts, updateShortcut, resetShortcut, resetAllShortcuts } =
    useKeyboardShortcuts();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<{
    key: string;
    modifiers: ModifierKey[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) {
          setEditingId(null);
          setRecordedKeys(null);
        } else if (isOpen) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, editingId]);

  // Focus input when editing
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  // Record key combination
  const handleKeyCapture = useCallback((e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore modifier-only presses
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) {
      return;
    }

    const modifiers: ModifierKey[] = [];
    if (e.metaKey || e.ctrlKey) modifiers.push('meta');
    if (e.altKey) modifiers.push('alt');
    if (e.shiftKey) modifiers.push('shift');

    setRecordedKeys({ key: e.key, modifiers });
  }, []);

  // Save the recorded shortcut
  const handleSave = useCallback(
    (id: string) => {
      if (recordedKeys) {
        updateShortcut(id, recordedKeys.key, recordedKeys.modifiers);
      }
      setEditingId(null);
      setRecordedKeys(null);
    },
    [recordedKeys, updateShortcut],
  );

  // Cancel editing
  const handleCancel = useCallback(() => {
    setEditingId(null);
    setRecordedKeys(null);
  }, []);

  // Group shortcuts by category
  const groupedShortcuts = CATEGORY_ORDER.reduce(
    (acc, category) => {
      acc[category] = shortcuts.filter((s) => s.category === category);
      return acc;
    },
    {} as Record<ShortcutCategory, ShortcutDefinition[]>,
  );

  if (!isOpen) return null;

  return (
    <div className="shortcut-settings-overlay" onClick={onClose}>
      <div
        className="shortcut-settings-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2>Keyboard Shortcuts</h2>
          <div className="header-actions">
            <button className="reset-all-btn" onClick={resetAllShortcuts}>
              Reset All
            </button>
            <button className="close-btn" onClick={onClose}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="settings-content">
          {CATEGORY_ORDER.map((category) => {
            const categoryShortcuts = groupedShortcuts[category];
            if (!categoryShortcuts || categoryShortcuts.length === 0)
              return null;

            return (
              <div key={category} className="shortcut-category">
                <h3 className="category-title">{CATEGORY_LABELS[category]}</h3>
                <div className="shortcut-list">
                  {categoryShortcuts.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className={`shortcut-item ${editingId === shortcut.id ? 'editing' : ''}`}
                    >
                      <div className="shortcut-info">
                        <span className="shortcut-name">{shortcut.name}</span>
                        <span className="shortcut-description">
                          {shortcut.description}
                        </span>
                      </div>

                      <div className="shortcut-actions">
                        {editingId === shortcut.id ? (
                          <>
                            <input
                              ref={inputRef}
                              type="text"
                              className="shortcut-input"
                              placeholder="Press keys..."
                              value={
                                recordedKeys
                                  ? formatShortcut(
                                      recordedKeys.modifiers,
                                      recordedKeys.key,
                                    )
                                  : ''
                              }
                              onKeyDown={handleKeyCapture}
                              readOnly
                            />
                            <button
                              className="action-btn save"
                              onClick={() => handleSave(shortcut.id)}
                              disabled={!recordedKeys}
                            >
                              Save
                            </button>
                            <button
                              className="action-btn cancel"
                              onClick={handleCancel}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <kbd className="shortcut-key">
                              {formatShortcut(
                                shortcut.modifiers ?? shortcut.defaultModifiers,
                                shortcut.key ?? shortcut.defaultKey,
                              )}
                            </kbd>
                            <button
                              className="action-btn edit"
                              onClick={() => setEditingId(shortcut.id)}
                            >
                              Edit
                            </button>
                            {(shortcut.key !== shortcut.defaultKey ||
                              JSON.stringify(shortcut.modifiers) !==
                                JSON.stringify(shortcut.defaultModifiers)) && (
                              <button
                                className="action-btn reset"
                                onClick={() => resetShortcut(shortcut.id)}
                                title="Reset to default"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 16 16"
                                  fill="currentColor"
                                >
                                  <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
                                  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="settings-footer">
          <span className="footer-hint">
            Click "Edit" to customize a shortcut, then press your desired key
            combination.
          </span>
        </div>
      </div>
    </div>
  );
}

export default ShortcutSettings;
