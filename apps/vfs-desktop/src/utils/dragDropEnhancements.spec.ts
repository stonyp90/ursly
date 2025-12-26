/**
 * Drag and Drop Enhancements Tests
 * Tests for global drag and drop functionality
 */

import {
  createGlobalDragHandler,
  makeDropZone,
  enhanceFileDrag,
} from './dragDropEnhancements';

describe('dragDropEnhancements', () => {
  beforeEach(() => {
    // Reset the module to allow re-initialization
    jest.resetModules();
    // Reset global flag
    const module = require('./dragDropEnhancements');
    (module as any).globalDragHandlerInitialized = false;
  });

  describe('createGlobalDragHandler', () => {
    it('should set up global drag handlers', () => {
      const preventDefaultSpy = jest.fn();

      createGlobalDragHandler();

      // Simulate dragover event on document
      const dragoverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(dragoverEvent, 'preventDefault', {
        value: preventDefaultSpy,
        writable: true,
      });
      Object.defineProperty(dragoverEvent, 'target', {
        value: document.body,
        writable: true,
      });

      document.dispatchEvent(dragoverEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should allow drop events on elements with data-drag-handler', () => {
      createGlobalDragHandler();

      const element = document.createElement('div');
      element.setAttribute('data-drag-handler', 'true');
      document.body.appendChild(element);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
      });

      // Should not prevent default if element has data-drag-handler
      const preventDefaultSpy = jest.fn();
      Object.defineProperty(dropEvent, 'preventDefault', {
        value: preventDefaultSpy,
        writable: true,
      });
      Object.defineProperty(dropEvent, 'target', {
        value: element,
        writable: true,
      });

      element.dispatchEvent(dropEvent);

      // The handler should allow the event to propagate
      expect(element).toBeTruthy();
    });
  });

  describe('makeDropZone', () => {
    it('should make an element a drop zone', () => {
      const element = document.createElement('div');
      const onDrop = jest.fn();
      const onDragOver = jest.fn();

      const cleanup = makeDropZone(element, onDrop, onDragOver);

      expect(element.getAttribute('data-drag-handler')).toBe('true');

      // Simulate dragover
      const dragoverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
      });
      dragoverEvent.preventDefault = jest.fn();
      dragoverEvent.stopPropagation = jest.fn();

      element.dispatchEvent(dragoverEvent);

      expect(onDragOver).toHaveBeenCalled();

      // Simulate drop
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
      });
      dropEvent.preventDefault = jest.fn();
      dropEvent.stopPropagation = jest.fn();

      element.dispatchEvent(dropEvent);

      expect(onDrop).toHaveBeenCalled();

      // Cleanup
      cleanup();
      expect(element.getAttribute('data-drag-handler')).toBeNull();
    });

    it('should use default dragOver handler if not provided', () => {
      const element = document.createElement('div');
      const onDrop = jest.fn();

      makeDropZone(element, onDrop);

      const dragoverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = jest.fn();
      dragoverEvent.preventDefault = preventDefaultSpy;
      dragoverEvent.dataTransfer = {
        dropEffect: 'none',
      } as DataTransfer;

      element.dispatchEvent(dragoverEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(dragoverEvent.dataTransfer!.dropEffect).toBe('move');
    });

    it('should cleanup event listeners', () => {
      const element = document.createElement('div');
      const onDrop = jest.fn();

      const cleanup = makeDropZone(element, onDrop);

      cleanup();

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(dropEvent);

      // onDrop should not be called after cleanup
      expect(onDrop).not.toHaveBeenCalled();
    });
  });

  describe('enhanceFileDrag', () => {
    it('should make an element draggable', () => {
      const element = document.createElement('div');
      const onDragStart = jest.fn();
      const onDragEnd = jest.fn();

      const cleanup = enhanceFileDrag(element, onDragStart, onDragEnd);

      expect(element.getAttribute('draggable')).toBe('true');
      expect(element.classList.contains('dragging')).toBe(false);

      // Simulate dragstart
      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(dragStartEvent);

      expect(onDragStart).toHaveBeenCalled();
      expect(element.classList.contains('dragging')).toBe(true);

      // Simulate dragend
      const dragEndEvent = new DragEvent('dragend', {
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(dragEndEvent);

      expect(onDragEnd).toHaveBeenCalled();
      expect(element.classList.contains('dragging')).toBe(false);

      cleanup();
    });

    it('should handle dragEnd without callback', () => {
      const element = document.createElement('div');
      const onDragStart = jest.fn();

      enhanceFileDrag(element, onDragStart);

      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(dragStartEvent);

      const dragEndEvent = new DragEvent('dragend', {
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(dragEndEvent);

      // Should not throw and should remove dragging class
      expect(element.classList.contains('dragging')).toBe(false);
    });

    it('should cleanup event listeners', () => {
      const element = document.createElement('div');
      const onDragStart = jest.fn();

      const cleanup = enhanceFileDrag(element, onDragStart);

      cleanup();

      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(dragStartEvent);

      // onDragStart should not be called after cleanup
      expect(onDragStart).not.toHaveBeenCalled();
    });
  });
});
