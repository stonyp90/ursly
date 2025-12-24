/**
 * Keyboard Shortcuts Configuration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_SHORTCUTS,
  formatShortcut,
  matchesShortcut,
  type ModifierKey,
} from './useKeyboardShortcuts';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock navigator for platform detection
Object.defineProperty(global, 'navigator', {
  value: { platform: 'MacIntel' },
  writable: true,
});

describe('Keyboard Shortcuts System', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('DEFAULT_SHORTCUTS', () => {
    it('should have all required properties', () => {
      DEFAULT_SHORTCUTS.forEach((shortcut) => {
        expect(shortcut.id).toBeDefined();
        expect(shortcut.name).toBeDefined();
        expect(shortcut.description).toBeDefined();
        expect(shortcut.category).toBeDefined();
        expect(shortcut.defaultKey).toBeDefined();
        expect(shortcut.defaultModifiers).toBeDefined();
      });
    });

    it('should have unique IDs', () => {
      const ids = DEFAULT_SHORTCUTS.map((s) => s.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });

    it('should have valid categories', () => {
      const validCategories = [
        'navigation',
        'selection',
        'clipboard',
        'file-operations',
        'view',
        'search',
      ];
      DEFAULT_SHORTCUTS.forEach((shortcut) => {
        expect(validCategories).toContain(shortcut.category);
      });
    });

    it('should include essential shortcuts', () => {
      const essentialIds = [
        'copy',
        'cut',
        'paste',
        'delete',
        'new-folder',
        'rename',
        'select-all',
      ];
      essentialIds.forEach((id) => {
        const found = DEFAULT_SHORTCUTS.find((s) => s.id === id);
        expect(found).toBeDefined();
      });
    });
  });

  describe('formatShortcut', () => {
    it('should format single key shortcut', () => {
      const result = formatShortcut([], 'Enter');
      expect(result).toBe('↵');
    });

    it('should format meta + key shortcut on Mac', () => {
      const result = formatShortcut(['meta'], 'c');
      expect(result).toBe('⌘C');
    });

    it('should format meta + shift + key shortcut', () => {
      const result = formatShortcut(['meta', 'shift'], 'n');
      expect(result).toBe('⌘⇧N');
    });

    it('should format arrow keys', () => {
      expect(formatShortcut([], 'ArrowUp')).toBe('↑');
      expect(formatShortcut([], 'ArrowDown')).toBe('↓');
      expect(formatShortcut([], 'ArrowLeft')).toBe('←');
      expect(formatShortcut([], 'ArrowRight')).toBe('→');
    });

    it('should format special keys', () => {
      expect(formatShortcut([], 'Backspace')).toBe('⌫');
      expect(formatShortcut([], 'Escape')).toBe('Esc');
      expect(formatShortcut([], 'Tab')).toBe('⇥');
      expect(formatShortcut([], ' ')).toBe('Space');
    });

    it('should handle alt modifier', () => {
      const result = formatShortcut(['alt'], 'a');
      expect(result).toBe('⌥A');
    });
  });

  describe('matchesShortcut', () => {
    const createKeyboardEvent = (
      key: string,
      metaKey = false,
      ctrlKey = false,
      altKey = false,
      shiftKey = false,
    ): KeyboardEvent => {
      return {
        key,
        metaKey,
        ctrlKey,
        altKey,
        shiftKey,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as KeyboardEvent;
    };

    it('should match simple key press', () => {
      const event = createKeyboardEvent('Enter');
      expect(matchesShortcut(event, [], 'Enter')).toBe(true);
    });

    it('should match meta + key', () => {
      const event = createKeyboardEvent('c', true, false, false, false);
      expect(matchesShortcut(event, ['meta'], 'c')).toBe(true);
    });

    it('should match ctrl + key (Windows style triggers meta)', () => {
      const event = createKeyboardEvent('c', false, true, false, false);
      expect(matchesShortcut(event, ['meta'], 'c')).toBe(true);
    });

    it('should match meta + shift + key', () => {
      const event = createKeyboardEvent('N', true, false, false, true);
      expect(matchesShortcut(event, ['meta', 'shift'], 'N')).toBe(true);
    });

    it('should not match if modifiers differ', () => {
      const event = createKeyboardEvent('c', false, false, false, false);
      expect(matchesShortcut(event, ['meta'], 'c')).toBe(false);
    });

    it('should not match if key differs', () => {
      const event = createKeyboardEvent('x', true, false, false, false);
      expect(matchesShortcut(event, ['meta'], 'c')).toBe(false);
    });

    it('should match case-insensitively', () => {
      const event = createKeyboardEvent('C', true, false, false, false);
      expect(matchesShortcut(event, ['meta'], 'c')).toBe(true);
    });
  });

  describe('Shortcut persistence', () => {
    it('should save customized shortcuts to localStorage', () => {
      const customized = {
        copy: { key: 'd', modifiers: ['meta'] as ModifierKey[] },
      };
      localStorage.setItem(
        'ursly-keyboard-shortcuts',
        JSON.stringify(customized),
      );

      const saved = localStorage.getItem('ursly-keyboard-shortcuts');
      expect(saved).not.toBeNull();

      const parsed = JSON.parse(saved!);
      expect(parsed.copy.key).toBe('d');
    });

    it('should load customized shortcuts from localStorage', () => {
      const customized = {
        copy: { key: 'd', modifiers: ['meta'] as ModifierKey[] },
      };
      localStorage.setItem(
        'ursly-keyboard-shortcuts',
        JSON.stringify(customized),
      );

      const saved = localStorage.getItem('ursly-keyboard-shortcuts');
      const parsed = JSON.parse(saved!);

      // Apply to default shortcuts
      const shortcuts = DEFAULT_SHORTCUTS.map((s) => ({
        ...s,
        key: parsed[s.id]?.key ?? s.defaultKey,
        modifiers: parsed[s.id]?.modifiers ?? s.defaultModifiers,
      }));

      const copyShortcut = shortcuts.find((s) => s.id === 'copy');
      expect(copyShortcut?.key).toBe('d');
    });

    it('should fall back to defaults if no stored value', () => {
      const saved = localStorage.getItem('ursly-keyboard-shortcuts');
      expect(saved).toBeNull();

      const copyShortcut = DEFAULT_SHORTCUTS.find((s) => s.id === 'copy');
      expect(copyShortcut?.defaultKey).toBe('c');
    });
  });

  describe('Shortcut reset', () => {
    it('should reset single shortcut to default', () => {
      let shortcuts = DEFAULT_SHORTCUTS.map((s) => ({
        ...s,
        key: s.id === 'copy' ? 'd' : s.defaultKey,
        modifiers: s.defaultModifiers,
      }));

      // Reset copy shortcut
      shortcuts = shortcuts.map((s) =>
        s.id === 'copy'
          ? { ...s, key: s.defaultKey, modifiers: s.defaultModifiers }
          : s,
      );

      const copyShortcut = shortcuts.find((s) => s.id === 'copy');
      expect(copyShortcut?.key).toBe('c');
    });

    it('should reset all shortcuts to defaults', () => {
      const shortcuts = DEFAULT_SHORTCUTS.map((s) => ({
        ...s,
        key: s.defaultKey,
        modifiers: s.defaultModifiers,
      }));

      shortcuts.forEach((s) => {
        expect(s.key).toBe(s.defaultKey);
        expect(s.modifiers).toEqual(s.defaultModifiers);
      });
    });
  });

  describe('Shortcut categories', () => {
    it('should group shortcuts by category', () => {
      const grouped = DEFAULT_SHORTCUTS.reduce(
        (acc, s) => {
          if (!acc[s.category]) acc[s.category] = [];
          acc[s.category].push(s);
          return acc;
        },
        {} as Record<string, typeof DEFAULT_SHORTCUTS>,
      );

      expect(Object.keys(grouped).length).toBeGreaterThan(0);
      expect(grouped['clipboard']?.length).toBeGreaterThan(0);
      expect(grouped['navigation']?.length).toBeGreaterThan(0);
    });
  });
});
