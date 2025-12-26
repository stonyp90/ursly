/**
 * useDraggableSection - Hook for making sidebar sections draggable/reorderable
 * VSCode-style section reordering
 */

import { useState, useRef, useCallback } from 'react';

export interface DraggableSectionConfig {
  id: string;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

export function useDraggableSection(config: DraggableSectionConfig) {
  const { id, onReorder } = config;
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragStartIndex = useRef<number | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      dragStartIndex.current = index;
      setIsDragging(true);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    },
    [id],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (targetId !== id && dragStartIndex.current !== null) {
        setDragOverId(targetId);
      }
    },
    [id],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      setDragOverId(null);

      if (dragStartIndex.current !== null && onReorder) {
        onReorder(dragStartIndex.current, targetIndex);
      }

      dragStartIndex.current = null;
      setIsDragging(false);
    },
    [onReorder],
  );

  const handleDragEnd = useCallback(() => {
    dragStartIndex.current = null;
    setIsDragging(false);
    setDragOverId(null);
  }, []);

  return {
    isDragging,
    dragOverId,
    handlers: {
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
      onDragEnd: handleDragEnd,
    },
  };
}

