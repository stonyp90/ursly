/**
 * useDraggablePanel - VSCode-style draggable panel hook
 * Enables dragging UI sections with pin/follow behavior
 */

import { useState, useRef, useCallback } from 'react';

export interface DraggablePanelConfig {
  id: string;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
  pinned?: boolean;
  followSelection?: boolean;
  bounds?: 'window' | 'parent' | HTMLElement;
}

export interface DraggablePanelState {
  position: { x: number; y: number };
  size: { width: number; height: number };
  isDragging: boolean;
  isResizing: boolean;
  pinned: boolean;
  followSelection?: boolean;
  zIndex: number;
}

export function useDraggablePanel(config: DraggablePanelConfig) {
  const {
    initialPosition = { x: 0, y: 0 },
    initialSize = { width: 300, height: 400 },
    minSize = { width: 200, height: 200 },
    maxSize = { width: 1200, height: 800 },
    pinned: initialPinned = false,
    bounds = 'window',
  } = config;

  const [state, setState] = useState<DraggablePanelState>({
    position: initialPosition,
    size: initialSize,
    isDragging: false,
    isResizing: false,
    pinned: initialPinned,
    zIndex: 1000,
  });

  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const resizeStartPos = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const resizeHandle = useRef<
    'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null
  >(null);

  // Get bounds element
  const getBoundsElement = useCallback((): HTMLElement | null => {
    if (bounds === 'window') return document.body;
    if (bounds === 'parent') return panelRef.current?.parentElement || null;
    return bounds;
  }, [bounds]);

  // Clamp position within bounds
  const clampPosition = useCallback(
    (x: number, y: number): { x: number; y: number } => {
      const boundsEl = getBoundsElement();
      if (!boundsEl || !panelRef.current) return { x, y };

      const boundsRect = boundsEl.getBoundingClientRect();
      const panelRect = panelRef.current.getBoundingClientRect();

      const minX = boundsRect.left;
      const maxX = boundsRect.right - panelRect.width;
      const minY = boundsRect.top;
      const maxY = boundsRect.bottom - panelRect.height;

      return {
        x: Math.max(minX, Math.min(maxX, x)),
        y: Math.max(minY, Math.min(maxY, y)),
      };
    },
    [getBoundsElement],
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (state.pinned) return; // Don't drag if pinned

      e.preventDefault();
      const startX = e.clientX - state.position.x;
      const startY = e.clientY - state.position.y;
      dragStartPos.current = { x: startX, y: startY };

      setState((prev) => ({
        ...prev,
        isDragging: true,
        zIndex: prev.zIndex + 1,
      }));

      // Add global mouse move/up listeners
      const handleMouseMove = (e: MouseEvent) => {
        if (!dragStartPos.current) return;

        const newX = e.clientX - dragStartPos.current.x;
        const newY = e.clientY - dragStartPos.current.y;
        const clamped = clampPosition(newX, newY);

        setState((prev) => ({
          ...prev,
          position: clamped,
        }));
      };

      const handleMouseUp = () => {
        dragStartPos.current = null;
        setState((prev) => ({
          ...prev,
          isDragging: false,
        }));
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [state.position, state.pinned, clampPosition],
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (
      e: React.MouseEvent,
      handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw',
    ) => {
      e.preventDefault();
      e.stopPropagation();

      resizeHandle.current = handle;
      resizeStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        width: state.size.width,
        height: state.size.height,
      };

      setState((prev) => ({
        ...prev,
        isResizing: true,
      }));

      const handleMouseMove = (e: MouseEvent) => {
        if (!resizeStartPos.current || !resizeHandle.current) return;

        const deltaX = e.clientX - resizeStartPos.current.x;
        const deltaY = e.clientY - resizeStartPos.current.y;
        let newWidth = resizeStartPos.current.width;
        let newHeight = resizeStartPos.current.height;

        const handle = resizeHandle.current;

        // Calculate new size based on handle
        if (handle.includes('e')) newWidth += deltaX;
        if (handle.includes('w')) newWidth -= deltaX;
        if (handle.includes('s')) newHeight += deltaY;
        if (handle.includes('n')) newHeight -= deltaY;

        // Clamp to min/max
        newWidth = Math.max(minSize.width, Math.min(maxSize.width, newWidth));
        newHeight = Math.max(
          minSize.height,
          Math.min(maxSize.height, newHeight),
        );

        setState((prev) => ({
          ...prev,
          size: { width: newWidth, height: newHeight },
        }));
      };

      const handleMouseUp = () => {
        resizeHandle.current = null;
        resizeStartPos.current = null;
        setState((prev) => ({
          ...prev,
          isResizing: false,
        }));
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [state.size, minSize, maxSize],
  );

  // Toggle pin
  const togglePin = useCallback(() => {
    setState((prev) => ({
      ...prev,
      pinned: !prev.pinned,
    }));
  }, []);

  // Toggle follow selection
  const toggleFollowSelection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      followSelection: !prev.followSelection,
    }));
  }, []);

  return {
    panelRef,
    state,
    handlers: {
      onDragStart: handleDragStart,
      onResizeStart: handleResizeStart,
      togglePin,
      toggleFollowSelection,
    },
  };
}
