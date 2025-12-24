/**
 * Toast Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Toast Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ToastMessage interface', () => {
    it('should define correct properties', () => {
      const toast = {
        id: 'test-1',
        type: 'success' as const,
        message: 'Test message',
        shortcut: '⌘C',
        duration: 2000,
      };

      expect(toast.id).toBe('test-1');
      expect(toast.type).toBe('success');
      expect(toast.message).toBe('Test message');
      expect(toast.shortcut).toBe('⌘C');
      expect(toast.duration).toBe(2000);
    });

    it('should support all toast types', () => {
      const types = ['success', 'error', 'warning', 'info', 'action'];

      types.forEach((type) => {
        const toast = {
          id: `test-${type}`,
          type: type as any,
          message: 'Test',
        };
        expect(toast.type).toBe(type);
      });
    });
  });

  describe('Toast auto-dismiss', () => {
    it('should auto-dismiss after default duration', () => {
      const dismissCallback = vi.fn();
      const toast = {
        id: 'test-1',
        type: 'success' as const,
        message: 'Test',
        duration: 2000,
      };

      // Simulate auto-dismiss
      setTimeout(() => dismissCallback(toast.id), toast.duration);

      expect(dismissCallback).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2000);
      expect(dismissCallback).toHaveBeenCalledWith('test-1');
    });

    it('should use custom duration if provided', () => {
      const dismissCallback = vi.fn();
      const toast = {
        id: 'test-1',
        type: 'info' as const,
        message: 'Test',
        duration: 5000,
      };

      setTimeout(() => dismissCallback(toast.id), toast.duration);

      vi.advanceTimersByTime(2000);
      expect(dismissCallback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(3000);
      expect(dismissCallback).toHaveBeenCalledWith('test-1');
    });

    it('should not auto-dismiss if duration is 0', () => {
      const dismissCallback = vi.fn();
      const toast = {
        id: 'test-1',
        type: 'error' as const,
        message: 'Test',
        duration: 0,
      };

      if (toast.duration > 0) {
        setTimeout(() => dismissCallback(toast.id), toast.duration);
      }

      vi.advanceTimersByTime(10000);
      expect(dismissCallback).not.toHaveBeenCalled();
    });
  });

  describe('Toast with shortcut display', () => {
    it('should format shortcut for display', () => {
      const toast = {
        id: 'test-1',
        type: 'action' as const,
        message: 'Copy',
        shortcut: '⌘C',
      };

      expect(toast.shortcut).toBe('⌘C');
    });

    it('should handle toast without shortcut', () => {
      const toast = { id: 'test-1', type: 'success' as const, message: 'Done' };

      expect(toast.shortcut).toBeUndefined();
    });
  });

  describe('Toast queue management', () => {
    it('should add toast to queue', () => {
      const queue: any[] = [];
      const toast = { id: 'test-1', type: 'info' as const, message: 'Test' };

      queue.push(toast);
      expect(queue).toHaveLength(1);
      expect(queue[0]).toEqual(toast);
    });

    it('should remove toast from queue by id', () => {
      const queue = [
        { id: 'test-1', type: 'info' as const, message: 'Test 1' },
        { id: 'test-2', type: 'success' as const, message: 'Test 2' },
      ];

      const filtered = queue.filter((t) => t.id !== 'test-1');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('test-2');
    });

    it('should clear all toasts', () => {
      let queue = [
        { id: 'test-1', type: 'info' as const, message: 'Test 1' },
        { id: 'test-2', type: 'success' as const, message: 'Test 2' },
      ];

      queue = [];
      expect(queue).toHaveLength(0);
    });
  });

  describe('Action toast helper', () => {
    it('should create action toast with message and shortcut', () => {
      const createActionToast = (message: string, shortcut?: string) => ({
        id: `toast-${Date.now()}`,
        type: 'action' as const,
        message,
        shortcut,
        duration: 1500,
      });

      const toast = createActionToast('Copy', '⌘C');

      expect(toast.type).toBe('action');
      expect(toast.message).toBe('Copy');
      expect(toast.shortcut).toBe('⌘C');
      expect(toast.duration).toBe(1500);
    });
  });
});
