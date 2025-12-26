/**
 * DraggableSection - VSCode-style draggable sidebar section
 * Allows reordering sections via drag and drop
 */

import React from 'react';
import { useDraggableSection } from '../../hooks/useDraggableSection';
import './DraggableSection.css';

export interface DraggableSectionProps {
  id: string;
  index: number;
  title: string;
  children: React.ReactNode;
  className?: string;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function DraggableSection({
  id,
  index,
  title,
  children,
  className = '',
  onReorder,
  collapsible = false,
  defaultCollapsed = false,
}: DraggableSectionProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const { isDragging, dragOverId, handlers } = useDraggableSection({
    id,
    onReorder,
  });

  const isDragOver = dragOverId === id;
  const isBeingDragged = isDragging;

  return (
    <div
      className={`draggable-section ${isDragOver ? 'drag-over' : ''} ${isBeingDragged ? 'dragging' : ''} ${className}`}
      draggable
      onDragStart={(e) => handlers.onDragStart(e, index)}
      onDragOver={(e) => handlers.onDragOver(e, id)}
      onDrop={(e) => handlers.onDrop(e, index)}
      onDragEnd={handlers.onDragEnd}
    >
      <div className="section-header">
        <div className="section-drag-handle">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="12" r="1" />
            <circle cx="15" cy="12" r="1" />
            <circle cx="9" cy="5" r="1" />
            <circle cx="15" cy="5" r="1" />
            <circle cx="9" cy="19" r="1" />
            <circle cx="15" cy="19" r="1" />
          </svg>
        </div>
        <span className="section-title">{title}</span>
        {collapsible && (
          <button
            className="section-collapse-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>
      {!isCollapsed && <div className="section-content">{children}</div>}
    </div>
  );
}

