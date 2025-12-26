/**
 * useDraggableSection Hook Tests
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  useDraggableSection,
  DraggableSectionConfig,
} from './useDraggableSection';

describe('useDraggableSection', () => {
  const defaultConfig: DraggableSectionConfig = {
    id: 'test-section',
    onReorder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Wrapper component for testing hooks - simple passthrough
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
  };

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useDraggableSection(defaultConfig), {
      wrapper,
    });

    expect(result.current.isDragging).toBe(false);
    expect(result.current.dragOverId).toBeNull();
  });

  it('should handle drag start', () => {
    const { result } = renderHook(() => useDraggableSection(defaultConfig), {
      wrapper,
    });

    const mockEvent = {
      dataTransfer: {
        effectAllowed: '',
        setData: jest.fn(),
      },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handlers.onDragStart(mockEvent, 0);
    });

    expect(result.current.isDragging).toBe(true);
    expect(mockEvent.dataTransfer.effectAllowed).toBe('move');
    expect(mockEvent.dataTransfer.setData).toHaveBeenCalledWith(
      'text/plain',
      'test-section',
    );
  });

  it('should handle drag over', () => {
    const { result } = renderHook(() => useDraggableSection(defaultConfig), {
      wrapper,
    });

    const mockEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        effectAllowed: '',
        setData: jest.fn(),
        dropEffect: 'none',
      },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handlers.onDragStart(mockEvent, 0);
    });

    const dragOverEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        dropEffect: 'none',
      },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handlers.onDragOver(dragOverEvent, 'target-section', 1);
    });

    expect(result.current.dragOverId).toBe('target-section');
    expect(dragOverEvent.dataTransfer?.dropEffect).toBe('move');
  });

  it('should not set dragOverId for same section', () => {
    const { result } = renderHook(() => useDraggableSection(defaultConfig), {
      wrapper,
    });

    const mockEvent = {
      dataTransfer: {
        effectAllowed: '',
        setData: jest.fn(),
      },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handlers.onDragStart(mockEvent, 0);
    });

    const dragOverEvent = {
      preventDefault: jest.fn(),
      dataTransfer: {
        dropEffect: 'none',
      },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handlers.onDragOver(dragOverEvent, 'test-section', 0);
    });

    // Should not set dragOverId for same section
    expect(result.current.dragOverId).toBeNull();
  });

  it('should handle drop', () => {
    const onReorder = jest.fn();
    const config = { ...defaultConfig, onReorder };
    const { result } = renderHook(() => useDraggableSection(config), {
      wrapper,
    });

    const mockEvent = {
      dataTransfer: {
        effectAllowed: '',
        setData: jest.fn(),
      },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handlers.onDragStart(mockEvent, 0);
    });

    const dropEvent = {
      preventDefault: jest.fn(),
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handlers.onDrop(dropEvent, 2);
    });

    expect(onReorder).toHaveBeenCalledWith(0, 2);
    expect(result.current.isDragging).toBe(false);
    expect(result.current.dragOverId).toBeNull();
  });

  it('should handle drag end', () => {
    const { result } = renderHook(() => useDraggableSection(defaultConfig), {
      wrapper,
    });

    const mockEvent = {
      dataTransfer: {
        effectAllowed: '',
        setData: jest.fn(),
      },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handlers.onDragStart(mockEvent, 0);
    });

    expect(result.current.isDragging).toBe(true);

    act(() => {
      result.current.handlers.onDragEnd();
    });

    expect(result.current.isDragging).toBe(false);
    expect(result.current.dragOverId).toBeNull();
  });

  it('should work without onReorder callback', () => {
    const config = { id: 'test-section' };
    const { result } = renderHook(() => useDraggableSection(config), {
      wrapper,
    });

    const mockEvent = {
      dataTransfer: {
        effectAllowed: '',
        setData: jest.fn(),
      },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handlers.onDragStart(mockEvent, 0);
    });

    const dropEvent = {
      preventDefault: jest.fn(),
    } as unknown as React.DragEvent;

    // Should not throw without onReorder
    expect(() => {
      act(() => {
        result.current.handlers.onDrop(dropEvent, 2);
      });
    }).not.toThrow();
  });
});
