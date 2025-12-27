/**
 * VFS File Card Component
 *
 * A modern file card with thumbnail preview, tier status indicators,
 * and contextual actions menu.
 */
import React, { useState, useRef, useEffect } from 'react';
import type { FileMetadata } from '../../types/storage';
import { FileActionsMenu, FileAction } from './FileActionsMenu';
import './VfsFileCard.css';

export interface VfsFileCardProps {
  file: FileMetadata;
  selected?: boolean;
  viewMode?: 'grid' | 'list';
  onSelect?: (file: FileMetadata, multiSelect: boolean) => void;
  onDoubleClick?: (file: FileMetadata) => void;
  onAction?: (action: FileAction, file: FileMetadata) => void;
  warmProgress?: number;
  transcodeProgress?: number;
  thumbnail?: string;
  /** If true, show only limited features for object storage (download, tier management, delete) */
  isObjectStorage?: boolean;
}

export function VfsFileCard({
  file,
  selected = false,
  viewMode = 'grid',
  onSelect,
  onDoubleClick,
  onAction,
  warmProgress,
  transcodeProgress,
  thumbnail,
  isObjectStorage = false,
}: VfsFileCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleClick = (e: React.MouseEvent) => {
    const multiSelect = e.metaKey || e.ctrlKey;
    onSelect?.(file, multiSelect);
  };

  const handleDoubleClick = () => {
    onDoubleClick?.(file);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const handleAction = (action: FileAction) => {
    setShowMenu(false);
    onAction?.(action, file);
  };

  const getFileIcon = () => {
    if (file.isDirectory) return '📁';

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const iconMap: Record<string, string> = {
      mp4: '🎬',
      mov: '🎬',
      mkv: '🎬',
      avi: '🎬',
      webm: '🎬',
      mp3: '🎵',
      wav: '🎵',
      flac: '🎵',
      jpg: '🖼️',
      jpeg: '🖼️',
      png: '🖼️',
      gif: '🖼️',
      webp: '🖼️',
      pdf: '📄',
      doc: '📝',
      docx: '📝',
      txt: '📃',
      zip: '📦',
      tar: '📦',
      gz: '📦',
    };

    return iconMap[ext] || '📄';
  };

  const getTierBadge = () => {
    const tierColors: Record<string, { bg: string; text: string }> = {
      hot: { bg: 'var(--vfs-tier-hot)', text: 'white' },
      warm: { bg: 'var(--vfs-tier-warm)', text: 'black' },
      cold: { bg: 'var(--vfs-tier-cold)', text: 'white' },
      archive: { bg: 'var(--vfs-tier-archive)', text: 'white' },
    };

    const tier = file.tierStatus?.toLowerCase() || 'hot';
    const colors = tierColors[tier] || tierColors.hot;

    return (
      <span
        className="tier-badge"
        style={{
          backgroundColor: colors.bg,
          color: colors.text,
        }}
      >
        {tier.toUpperCase()}
      </span>
    );
  };

  const renderProgress = () => {
    const progress = warmProgress ?? transcodeProgress;
    if (progress === undefined || progress >= 100) return null;

    const isTranscode = transcodeProgress !== undefined;

    return (
      <div className="progress-overlay">
        <div className="progress-bar">
          <div
            className={`progress-fill ${isTranscode ? 'transcode' : 'warm'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="progress-text">
          {isTranscode ? 'Transcoding' : 'Warming'}: {progress.toFixed(0)}%
        </span>
      </div>
    );
  };

  if (viewMode === 'list') {
    return (
      <div
        ref={cardRef}
        className={`vfs-file-card list-view ${selected ? 'selected' : ''}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        <div className="file-icon">{getFileIcon()}</div>
        <div className="file-info">
          <span className="file-name">{file.name}</span>
          <span className="file-meta">
            {file.isDirectory ? '--' : file.size_human}
          </span>
        </div>
        <div className="file-date">{file.lastModified}</div>
        <div className="file-tier">{getTierBadge()}</div>
        <div className="file-actions">
          {file.canWarm && !file.isCached && (
            <button
              className="action-btn warm"
              onClick={(e) => {
                e.stopPropagation();
                handleAction('warm');
              }}
              title="Hydrate file"
            >
              🔥
            </button>
          )}
          {file.canTranscode && (
            <button
              className="action-btn transcode"
              onClick={(e) => {
                e.stopPropagation();
                handleAction('transcode');
              }}
              title="Transcode to HLS"
            >
              🎥
            </button>
          )}
          <button
            className="action-btn menu"
            onClick={(e) => {
              e.stopPropagation();
              setMenuPosition({ x: e.clientX, y: e.clientY });
              setShowMenu(true);
            }}
            title="More actions"
          >
            ⋮
          </button>
        </div>
        {renderProgress()}
        {showMenu && (
          <FileActionsMenu
            file={file}
            position={menuPosition}
            onAction={handleAction}
            onClose={() => setShowMenu(false)}
            isObjectStorage={isObjectStorage}
          />
        )}
      </div>
    );
  }

  // Grid view
  return (
    <div
      ref={cardRef}
      className={`vfs-file-card grid-view ${selected ? 'selected' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <div className="card-thumbnail">
        {thumbnail ? (
          <img src={thumbnail} alt={file.name} />
        ) : (
          <span className="file-icon-large">{getFileIcon()}</span>
        )}
        {getTierBadge()}
        {renderProgress()}
      </div>
      <div className="card-content">
        <span className="file-name" title={file.name}>
          {file.name}
        </span>
        <span className="file-meta">
          {file.isDirectory ? 'Folder' : file.size_human}
        </span>
      </div>
      <div className="card-actions">
        {file.canWarm && !file.isCached && (
          <button
            className="action-btn warm"
            onClick={(e) => {
              e.stopPropagation();
              handleAction('warm');
            }}
            title="Hydrate file"
          >
            🔥
          </button>
        )}
        {file.canTranscode && (
          <button
            className="action-btn transcode"
            onClick={(e) => {
              e.stopPropagation();
              handleAction('transcode');
            }}
            title="Transcode to HLS"
          >
            🎥
          </button>
        )}
      </div>
      {showMenu && (
        <FileActionsMenu
          file={file}
          position={menuPosition}
          onAction={handleAction}
          onClose={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}

export default VfsFileCard;
