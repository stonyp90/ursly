/**
 * File Actions Context Menu
 *
 * Displays a contextual menu with file operations following POSIX semantics.
 */
import React, { useEffect, useRef } from 'react';
import type { FileMetadata } from '../../types/storage';
import './VfsFileCard.css';

export type FileAction =
  | 'open'
  | 'rename'
  | 'copy'
  | 'move'
  | 'delete'
  | 'warm'
  | 'transcode'
  | 'download'
  | 'info'
  | 'share'
  | 'archive'
  | 'retrieve'
  | 'mkdir'
  | 'preview'
  | 'tier-hot'
  | 'tier-instant-retrieval'
  | 'tier-cold';

interface MenuAction {
  id: FileAction;
  label: string;
  icon: string;
  shortcut?: string;
  divider?: boolean;
  disabled?: boolean;
  danger?: boolean;
}

interface FileActionsMenuProps {
  file: FileMetadata;
  position: { x: number; y: number };
  onAction: (action: FileAction) => void;
  onClose: () => void;
  /** If true, show only limited features for object storage (download, tier management, delete) */
  isObjectStorage?: boolean;
}

export function FileActionsMenu({
  file,
  position,
  onAction,
  onClose,
  isObjectStorage = false,
}: FileActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position if menu would go off-screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      if (x + rect.width > windowWidth) {
        x = windowWidth - rect.width - 10;
      }
      if (y + rect.height > windowHeight) {
        y = windowHeight - rect.height - 10;
      }

      menuRef.current.style.left = `${x}px`;
      menuRef.current.style.top = `${y}px`;
    }
  }, [position]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getMenuActions = (): MenuAction[] => {
    const actions: MenuAction[] = [];

    // For object storage, show only limited features: download, tier management, delete
    if (isObjectStorage) {
      // Download
      if (!file.isDirectory) {
        actions.push({
          id: 'download',
          label: 'Download',
          icon: '⬇️',
          shortcut: '⌘D',
        });
      }

      // Tier management (only for files)
      if (!file.isDirectory) {
        actions.push({
          id: 'tier-hot',
          label: 'Move to Hot Tier',
          icon: '🔥',
          divider: true,
        });
        actions.push({
          id: 'tier-instant-retrieval',
          label: 'Move to Instant Retrieval',
          icon: '⚡',
        });
        actions.push({
          id: 'tier-cold',
          label: 'Move to Cold Tier',
          icon: '❄️',
        });
      }

      // Delete
      actions.push({
        id: 'delete',
        label: 'Delete',
        icon: '🗑️',
        shortcut: '⌘⌫',
        danger: true,
      });

      return actions;
    }

    // Full feature set for non-object storage (mount-based storage)

    // Open action
    actions.push({
      id: 'open',
      label: file.isDirectory ? 'Open Folder' : 'Open',
      icon: file.isDirectory ? '📂' : '📄',
      shortcut: '⌘O',
    });

    // Preview (for supported file types)
    if (
      !file.isDirectory &&
      (file.canTranscode || file.name.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/i))
    ) {
      actions.push({
        id: 'preview',
        label: 'Quick Look',
        icon: '👁️',
        shortcut: 'Space',
      });
    }

    actions.push({
      id: 'info',
      label: 'Get Info',
      icon: 'ℹ️',
      shortcut: '⌘I',
      divider: true,
    });

    // File operations
    actions.push({ id: 'rename', label: 'Rename', icon: '✏️', shortcut: '⏎' });
    actions.push({ id: 'copy', label: 'Copy', icon: '📋', shortcut: '⌘C' });
    actions.push({
      id: 'move',
      label: 'Move To...',
      icon: '📦',
      shortcut: '⌘M',
    });

    if (!file.isDirectory) {
      actions.push({
        id: 'download',
        label: 'Download',
        icon: '⬇️',
        shortcut: '⌘D',
        divider: true,
      });
    } else {
      actions.push({
        id: 'mkdir',
        label: 'New Folder Inside',
        icon: '📁',
        divider: true,
      });
    }

    // Tier operations
    if (file.canWarm && !file.isCached) {
      actions.push({
        id: 'warm',
        label: 'Hydrate (Warm)',
        icon: '🔥',
        shortcut: '⌘H',
      });
    }

    if ((file.tierStatus as string) === 'archive') {
      actions.push({
        id: 'retrieve',
        label: 'Retrieve from Archive',
        icon: '📤',
      });
    } else if (!file.isDirectory) {
      actions.push({
        id: 'archive',
        label: 'Move to Archive',
        icon: '📥',
      });
    }

    // Transcode (video files only)
    if (file.canTranscode) {
      actions.push({
        id: 'transcode',
        label: 'Transcode to HLS',
        icon: '🎥',
        shortcut: '⌘T',
        divider: true,
      });
    }

    // Share
    actions.push({
      id: 'share',
      label: 'Share...',
      icon: '🔗',
      shortcut: '⌘⇧S',
      divider: true,
    });

    // Delete
    actions.push({
      id: 'delete',
      label: 'Move to Trash',
      icon: '🗑️',
      shortcut: '⌘⌫',
      danger: true,
    });

    return actions;
  };

  const handleActionClick = (action: MenuAction) => {
    if (action.disabled) return;
    onAction(action.id);
  };

  const actions = getMenuActions();

  return (
    <div
      ref={menuRef}
      className="file-actions-menu"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="menu-header">
        <span className="menu-title">{file.name}</span>
        <span className="menu-subtitle">
          {file.isDirectory ? 'Folder' : file.size_human}
        </span>
      </div>
      <div className="menu-divider" />
      {actions.map((action, index) => (
        <React.Fragment key={action.id}>
          <button
            className={`menu-item ${action.disabled ? 'disabled' : ''} ${action.danger ? 'danger' : ''}`}
            onClick={() => handleActionClick(action)}
            disabled={action.disabled}
          >
            <span className="menu-icon">{action.icon}</span>
            <span className="menu-label">{action.label}</span>
            {action.shortcut && (
              <span className="menu-shortcut">{action.shortcut}</span>
            )}
          </button>
          {action.divider && index < actions.length - 1 && (
            <div className="menu-divider" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default FileActionsMenu;
