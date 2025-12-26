/**
 * DraggablePanel - VSCode-style draggable panel component
 * Supports dragging, resizing, pinning, and follow selection
 */

import React from 'react';
import {
  useDraggablePanel,
  DraggablePanelConfig,
} from '../../hooks/useDraggablePanel';
import './DraggablePanel.css';

export interface DraggablePanelProps extends DraggablePanelConfig {
  title: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
  onClose?: () => void;
}

export function DraggablePanel({
  title,
  children,
  className = '',
  headerActions,
  onClose,
  ...config
}: DraggablePanelProps) {
  const { panelRef, state, handlers } = useDraggablePanel(config);

  return (
    <div
      ref={panelRef}
      className={`draggable-panel ${state.pinned ? 'pinned' : ''} ${state.isDragging ? 'dragging' : ''} ${state.isResizing ? 'resizing' : ''} ${className}`}
      style={{
        position: state.pinned ? 'relative' : 'fixed',
        left: state.pinned ? 'auto' : `${state.position.x}px`,
        top: state.pinned ? 'auto' : `${state.position.y}px`,
        width: `${state.size.width}px`,
        height: `${state.size.height}px`,
        zIndex: state.zIndex,
      }}
    >
      {/* Header - draggable area */}
      <div
        className="draggable-panel-header"
        onMouseDown={handlers.onDragStart}
      >
        <div className="panel-header-content">
          <span className="panel-title">{title}</span>
          <div className="panel-header-actions">
            {headerActions}
            <button
              className="panel-action-btn"
              onClick={handlers.togglePin}
              title={state.pinned ? 'Unpin panel' : 'Pin panel'}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                {state.pinned ? (
                  <path d="M12 17v5M9 10V7a3 3 0 0 1 6 0v3M5 10h14l-1 7H6l-1-7z" />
                ) : (
                  <path
                    d="M12 17v5M9 10V7a3 3 0 0 1 6 0v3M5 10h14l-1 7H6l-1-7z"
                    strokeDasharray="2 2"
                  />
                )}
              </svg>
            </button>
            {onClose && (
              <button
                className="panel-action-btn close-btn"
                onClick={onClose}
                title="Close panel"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="draggable-panel-content">{children}</div>

      {/* Resize handles */}
      {!state.pinned && (
        <>
          <div
            className="resize-handle resize-n"
            onMouseDown={(e) => handlers.onResizeStart(e, 'n')}
          />
          <div
            className="resize-handle resize-s"
            onMouseDown={(e) => handlers.onResizeStart(e, 's')}
          />
          <div
            className="resize-handle resize-e"
            onMouseDown={(e) => handlers.onResizeStart(e, 'e')}
          />
          <div
            className="resize-handle resize-w"
            onMouseDown={(e) => handlers.onResizeStart(e, 'w')}
          />
          <div
            className="resize-handle resize-ne"
            onMouseDown={(e) => handlers.onResizeStart(e, 'ne')}
          />
          <div
            className="resize-handle resize-nw"
            onMouseDown={(e) => handlers.onResizeStart(e, 'nw')}
          />
          <div
            className="resize-handle resize-se"
            onMouseDown={(e) => handlers.onResizeStart(e, 'se')}
          />
          <div
            className="resize-handle resize-sw"
            onMouseDown={(e) => handlers.onResizeStart(e, 'sw')}
          />
        </>
      )}
    </div>
  );
}
