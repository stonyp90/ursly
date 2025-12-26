/**
 * useDraggablePanel Hook Tests
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useDraggablePanel, DraggablePanelConfig } from './useDraggablePanel';

// Wrapper component for testing hooks
const wrapper = ({ children }: { children: React.ReactNode }) => {
  return React.createElement(React.Fragment, null, children);
};

describe('useDraggablePanel', () => {
  const defaultConfig: DraggablePanelConfig = {
    id: 'test-panel',
    initialPosition: { x: 100, y: 100 },
    initialSize: { width: 300, height: 400 },
    minSize: { width: 200, height: 200 },
    maxSize: { width: 1200, height: 800 },
  };

  beforeEach(() => {
    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 300,
      height: 400,
      top: 0,
      left: 0,
      bottom: 400,
      right: 300,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useDraggablePanel(defaultConfig), {
      wrapper,
    });

    expect(result.current.state.position).toEqual({ x: 100, y: 100 });
    expect(result.current.state.size).toEqual({ width: 300, height: 400 });
    expect(result.current.state.isDragging).toBe(false);
    expect(result.current.state.isResizing).toBe(false);
    expect(result.current.state.pinned).toBe(false);
    expect(result.current.state.zIndex).toBe(1000);
  });

  it('should initialize with pinned state when configured', () => {
    const config = { ...defaultConfig, pinned: true };
    const { result } = renderHook(() => useDraggablePanel(config), {
      wrapper,
    });

    expect(result.current.state.pinned).toBe(true);
  });

  it('should toggle pin state', () => {
    const { result } = renderHook(() => useDraggablePanel(defaultConfig), {
      wrapper,
    });

    expect(result.current.state.pinned).toBe(false);

    act(() => {
      result.current.handlers.togglePin();
    });

    expect(result.current.state.pinned).toBe(true);

    act(() => {
      result.current.handlers.togglePin();
    });

    expect(result.current.state.pinned).toBe(false);
  });

  it('should not allow dragging when pinned', () => {
    const config = { ...defaultConfig, pinned: true };
    const { result } = renderHook(() => useDraggablePanel(config), {
      wrapper,
    });

    const mockEvent = {
      preventDefault: jest.fn(),
      clientX: 200,
      clientY: 200,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handlers.onDragStart(mockEvent);
    });

    // Should not start dragging when pinned
    expect(result.current.state.isDragging).toBe(false);
  });

  it('should start dragging when not pinned', () => {
    const { result } = renderHook(() => useDraggablePanel(defaultConfig), {
      wrapper,
    });

    const mockEvent = {
      preventDefault: jest.fn(),
      clientX: 200,
      clientY: 200,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handlers.onDragStart(mockEvent);
    });

    expect(result.current.state.isDragging).toBe(true);
    expect(result.current.state.zIndex).toBeGreaterThan(1000);
  });

  it('should handle resize start', () => {
    const { result } = renderHook(() => useDraggablePanel(defaultConfig), {
      wrapper,
    });

    const mockEvent = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      clientX: 400,
      clientY: 500,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handlers.onResizeStart(mockEvent, 'se');
    });

    expect(result.current.state.isResizing).toBe(true);
  });

  it('should clamp size to min/max bounds', () => {
    const { result } = renderHook(() => useDraggablePanel(defaultConfig), {
      wrapper,
    });

    const mockEvent = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      clientX: 50, // Very small
      clientY: 50,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handlers.onResizeStart(mockEvent, 'nw');
    });

    // Simulate mouse move to very small size
    const moveEvent = new MouseEvent('mousemove', {
      clientX: 0,
      clientY: 0,
    });

    act(() => {
      document.dispatchEvent(moveEvent);
    });

    // Size should be clamped to minSize
    expect(result.current.state.size.width).toBeGreaterThanOrEqual(200);
    expect(result.current.state.size.height).toBeGreaterThanOrEqual(200);
  });

  it('should handle window bounds', () => {
    const config = { ...defaultConfig, bounds: 'window' as const };
    const { result } = renderHook(() => useDraggablePanel(config), {
      wrapper,
    });

    expect(result.current).toBeDefined();
    // getBoundsElement should return document.body for 'window'
  });

  it('should handle parent bounds', () => {
    const config = { ...defaultConfig, bounds: 'parent' as const };
    const { result } = renderHook(() => useDraggablePanel(config), {
      wrapper,
    });

    expect(result.current).toBeDefined();
  });
});
