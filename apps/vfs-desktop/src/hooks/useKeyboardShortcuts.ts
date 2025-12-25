/**
 * useKeyboardShortcuts - Configurable keyboard shortcut system
 *
 * Provides a way to define, customize, and persist keyboard shortcuts.
 * Users can remap any shortcut to their preferred key combination.
 */

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from 'react';

// Platform detection
const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/**
 * Modifier keys
 */
export type ModifierKey = 'meta' | 'ctrl' | 'alt' | 'shift';

/**
 * Shortcut definition
 */
export interface ShortcutDefinition {
  id: string;
  name: string;
  description: string;
  category: ShortcutCategory;
  defaultKey: string;
  defaultModifiers: ModifierKey[];
  // Current customized values (loaded from storage)
  key?: string;
  modifiers?: ModifierKey[];
}

export type ShortcutCategory =
  | 'navigation'
  | 'selection'
  | 'clipboard'
  | 'file-operations'
  | 'view'
  | 'search';

/**
 * Default keyboard shortcuts
 */
export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // Navigation
  {
    id: 'go-back',
    name: 'Go Back',
    description: 'Navigate to previous folder',
    category: 'navigation',
    defaultKey: '[',
    defaultModifiers: ['meta'],
  },
  {
    id: 'go-forward',
    name: 'Go Forward',
    description: 'Navigate to next folder',
    category: 'navigation',
    defaultKey: ']',
    defaultModifiers: ['meta'],
  },
  {
    id: 'go-up',
    name: 'Go to Parent',
    description: 'Navigate to parent folder',
    category: 'navigation',
    defaultKey: 'ArrowUp',
    defaultModifiers: ['meta'],
  },
  {
    id: 'open',
    name: 'Open',
    description: 'Open selected item',
    category: 'navigation',
    defaultKey: 'Enter',
    defaultModifiers: [],
  },

  // Selection
  {
    id: 'select-all',
    name: 'Select All',
    description: 'Select all items',
    category: 'selection',
    defaultKey: 'a',
    defaultModifiers: ['meta'],
  },
  {
    id: 'deselect',
    name: 'Deselect All',
    description: 'Clear selection',
    category: 'selection',
    defaultKey: 'Escape',
    defaultModifiers: [],
  },

  // Clipboard
  {
    id: 'copy',
    name: 'Copy',
    description: 'Copy selected items',
    category: 'clipboard',
    defaultKey: 'c',
    defaultModifiers: ['meta'],
  },
  {
    id: 'paste',
    name: 'Paste',
    description: 'Paste items',
    category: 'clipboard',
    defaultKey: 'v',
    defaultModifiers: ['meta'],
  },
  {
    id: 'duplicate',
    name: 'Duplicate',
    description: 'Duplicate selected items',
    category: 'clipboard',
    defaultKey: 'd',
    defaultModifiers: ['meta'],
  },

  // File Operations
  {
    id: 'new-folder',
    name: 'New Folder',
    description: 'Create a new folder',
    category: 'file-operations',
    defaultKey: 'n',
    defaultModifiers: ['meta', 'shift'],
  },
  {
    id: 'rename',
    name: 'Rename',
    description: 'Rename selected item',
    category: 'file-operations',
    defaultKey: 'Enter',
    defaultModifiers: [],
  },
  {
    id: 'delete',
    name: 'Delete',
    description: 'Delete selected items',
    category: 'file-operations',
    defaultKey: 'Backspace',
    defaultModifiers: [],
  },
  {
    id: 'move-to-trash',
    name: 'Move to Trash',
    description: 'Move to trash',
    category: 'file-operations',
    defaultKey: 'Backspace',
    defaultModifiers: ['meta'],
  },
  {
    id: 'get-info',
    name: 'Asset Details',
    description: 'Show asset metadata and properties',
    category: 'file-operations',
    defaultKey: 'i',
    defaultModifiers: ['meta'],
  },

  // View
  {
    id: 'icon-view',
    name: 'Icon View',
    description: 'Switch to icon view',
    category: 'view',
    defaultKey: '1',
    defaultModifiers: ['meta'],
  },
  {
    id: 'list-view',
    name: 'List View',
    description: 'Switch to list view',
    category: 'view',
    defaultKey: '2',
    defaultModifiers: ['meta'],
  },
  {
    id: 'toggle-hidden',
    name: 'Toggle Hidden',
    description: 'Show/hide hidden files',
    category: 'view',
    defaultKey: '.',
    defaultModifiers: ['meta', 'shift'],
  },
  {
    id: 'toggle-info-panel',
    name: 'Toggle Info Panel',
    description: 'Show/hide info panel',
    category: 'view',
    defaultKey: 'i',
    defaultModifiers: ['meta', 'shift'],
  },

  // Search
  {
    id: 'search',
    name: 'Search',
    description: 'Focus search box',
    category: 'search',
    defaultKey: 'f',
    defaultModifiers: ['meta'],
  },
  {
    id: 'spotlight',
    name: 'Quick Search',
    description: 'Open spotlight-style quick search',
    category: 'search',
    defaultKey: 'k',
    defaultModifiers: ['meta'],
  },
  {
    id: 'show-shortcuts',
    name: 'Show Shortcuts',
    description: 'Show keyboard shortcuts',
    category: 'view',
    defaultKey: '?',
    defaultModifiers: [],
  },
];

const STORAGE_KEY = 'ursly-keyboard-shortcuts';

/**
 * Format shortcut for display
 */
export function formatShortcut(modifiers: ModifierKey[], key: string): string {
  const parts: string[] = [];

  if (modifiers.includes('meta')) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (modifiers.includes('ctrl') && !modifiers.includes('meta')) {
    parts.push('Ctrl');
  }
  if (modifiers.includes('alt')) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  if (modifiers.includes('shift')) {
    parts.push(isMac ? '⇧' : 'Shift');
  }

  // Format special keys
  const keyDisplay = formatKey(key);
  parts.push(keyDisplay);

  return parts.join(isMac ? '' : '+');
}

/**
 * Format individual key for display
 */
function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Enter: '↵',
    Backspace: isMac ? '⌫' : 'Backspace',
    Delete: isMac ? '⌦' : 'Del',
    Escape: 'Esc',
    Tab: '⇥',
    ' ': 'Space',
  };

  return keyMap[key] || key.toUpperCase();
}

/**
 * Check if an event matches a shortcut
 */
export function matchesShortcut(
  event: KeyboardEvent,
  modifiers: ModifierKey[],
  key: string,
): boolean {
  // Check modifiers
  const metaMatch =
    modifiers.includes('meta') === (event.metaKey || event.ctrlKey);
  const altMatch = modifiers.includes('alt') === event.altKey;
  const shiftMatch = modifiers.includes('shift') === event.shiftKey;

  // Check key
  const keyMatch =
    event.key.toLowerCase() === key.toLowerCase() || event.key === key;

  return metaMatch && altMatch && shiftMatch && keyMatch;
}

/**
 * Keyboard Shortcuts Context
 */
interface ShortcutsContextType {
  shortcuts: ShortcutDefinition[];
  getShortcut: (id: string) => ShortcutDefinition | undefined;
  updateShortcut: (id: string, key: string, modifiers: ModifierKey[]) => void;
  resetShortcut: (id: string) => void;
  resetAllShortcuts: () => void;
  formatShortcut: (id: string) => string;
  matchesShortcut: (event: KeyboardEvent, id: string) => boolean;
}

const ShortcutsContext = createContext<ShortcutsContextType | null>(null);

/**
 * Hook to use keyboard shortcuts
 */
export function useKeyboardShortcuts() {
  const context = useContext(ShortcutsContext);
  if (!context) {
    // Return standalone implementation if no provider
    return useStandaloneShortcuts();
  }
  return context;
}

/**
 * Standalone shortcuts hook (when not using provider)
 */
function useStandaloneShortcuts(): ShortcutsContextType {
  const [shortcuts, setShortcuts] = useState<ShortcutDefinition[]>(() => {
    // Load from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const customized = JSON.parse(saved) as Record<
          string,
          { key: string; modifiers: ModifierKey[] }
        >;
        return DEFAULT_SHORTCUTS.map((s) => ({
          ...s,
          key: customized[s.id]?.key ?? s.defaultKey,
          modifiers: customized[s.id]?.modifiers ?? s.defaultModifiers,
        }));
      }
    } catch (e) {
      console.error('Failed to load shortcuts:', e);
    }
    return DEFAULT_SHORTCUTS.map((s) => ({
      ...s,
      key: s.defaultKey,
      modifiers: s.defaultModifiers,
    }));
  });

  // Save to localStorage when shortcuts change
  useEffect(() => {
    const customized: Record<
      string,
      { key: string; modifiers: ModifierKey[] }
    > = {};
    shortcuts.forEach((s) => {
      if (
        s.key !== s.defaultKey ||
        JSON.stringify(s.modifiers) !== JSON.stringify(s.defaultModifiers)
      ) {
        customized[s.id] = { key: s.key!, modifiers: s.modifiers! };
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customized));
  }, [shortcuts]);

  const getShortcut = useCallback(
    (id: string) => {
      return shortcuts.find((s) => s.id === id);
    },
    [shortcuts],
  );

  const updateShortcut = useCallback(
    (id: string, key: string, modifiers: ModifierKey[]) => {
      setShortcuts((prev) =>
        prev.map((s) => (s.id === id ? { ...s, key, modifiers } : s)),
      );
    },
    [],
  );

  const resetShortcut = useCallback((id: string) => {
    setShortcuts((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, key: s.defaultKey, modifiers: s.defaultModifiers }
          : s,
      ),
    );
  }, []);

  const resetAllShortcuts = useCallback(() => {
    setShortcuts(
      DEFAULT_SHORTCUTS.map((s) => ({
        ...s,
        key: s.defaultKey,
        modifiers: s.defaultModifiers,
      })),
    );
  }, []);

  const formatShortcutById = useCallback(
    (id: string) => {
      const shortcut = shortcuts.find((s) => s.id === id);
      if (!shortcut) return '';
      return formatShortcut(
        shortcut.modifiers ?? shortcut.defaultModifiers,
        shortcut.key ?? shortcut.defaultKey,
      );
    },
    [shortcuts],
  );

  const matchesShortcutById = useCallback(
    (event: KeyboardEvent, id: string) => {
      const shortcut = shortcuts.find((s) => s.id === id);
      if (!shortcut) return false;
      return matchesShortcut(
        event,
        shortcut.modifiers ?? shortcut.defaultModifiers,
        shortcut.key ?? shortcut.defaultKey,
      );
    },
    [shortcuts],
  );

  return {
    shortcuts,
    getShortcut,
    updateShortcut,
    resetShortcut,
    resetAllShortcuts,
    formatShortcut: formatShortcutById,
    matchesShortcut: matchesShortcutById,
  };
}

export { ShortcutsContext };
export default useKeyboardShortcuts;
