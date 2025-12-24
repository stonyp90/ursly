/**
 * Media Preview Modal
 *
 * A full-featured media preview modal supporting:
 * - Video playback (HLS, MP4, MOV)
 * - Image viewing with zoom/pan
 * - Thumbnail timeline for videos
 * - Quick actions (transcode, download, info)
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { FileMetadata } from '../../types/storage';
import { HlsVideoPlayer } from './HlsVideoPlayer';
import './MediaPreview.css';

export interface MediaPreviewModalProps {
  file: FileMetadata;
  streamUrl?: string;
  thumbnails?: string[];
  onClose: () => void;
  onTranscode?: (format: 'hls' | 'dash' | 'mp4') => void;
  onDownload?: () => void;
}

type MediaType = 'video' | 'image' | 'audio' | 'document' | 'unknown';

export function MediaPreviewModal({
  file,
  streamUrl,
  thumbnails = [],
  onClose,
  onTranscode,
  onDownload,
}: MediaPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [currentThumbnail, setCurrentThumbnail] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const getMediaType = (): MediaType => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    const videoExts = ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'wmv'];
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'md'];

    if (videoExts.includes(ext)) return 'video';
    if (imageExts.includes(ext)) return 'image';
    if (audioExts.includes(ext)) return 'audio';
    if (docExts.includes(ext)) return 'document';
    return 'unknown';
  };

  const mediaType = getMediaType();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (thumbnails.length > 0) {
            setCurrentThumbnail((prev) => Math.max(0, prev - 1));
          }
          break;
        case 'ArrowRight':
          if (thumbnails.length > 0) {
            setCurrentThumbnail((prev) =>
              Math.min(thumbnails.length - 1, prev + 1),
            );
          }
          break;
        case 'i':
          setShowInfo((prev) => !prev);
          break;
        case '+':
        case '=':
          setZoom((prev) => Math.min(prev + 0.25, 4));
          break;
        case '-':
          setZoom((prev) => Math.max(prev - 0.25, 0.25));
          break;
        case '0':
          setZoom(1);
          setPan({ x: 0, y: 0 });
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, thumbnails.length]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const renderContent = () => {
    switch (mediaType) {
      case 'video':
        if (streamUrl) {
          return (
            <HlsVideoPlayer
              src={streamUrl}
              autoPlay
              onReady={() => setIsLoading(false)}
              onError={(err) => console.error('Video error:', err)}
            />
          );
        }
        return (
          <div className="preview-placeholder">
            <span className="placeholder-icon">🎬</span>
            <p>Video preview not available</p>
            {file.canTranscode && (
              <button
                className="btn-transcode"
                onClick={() => onTranscode?.('hls')}
              >
                🎥 Transcode to HLS
              </button>
            )}
          </div>
        );

      case 'image':
        return (
          <div
            className="image-viewer"
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            }}
          >
            <img
              src={file.thumbnail || `file://${file.path}`}
              alt={file.name}
              onLoad={() => setIsLoading(false)}
              draggable={false}
            />
          </div>
        );

      case 'audio':
        return (
          <div className="audio-player">
            <span className="audio-icon">🎵</span>
            <p>{file.name}</p>
            <audio controls autoPlay src={`file://${file.path}`} />
          </div>
        );

      case 'document':
        return (
          <div className="document-preview">
            <span className="document-icon">📄</span>
            <p>{file.name}</p>
            <button className="btn-download" onClick={onDownload}>
              ⬇️ Download to view
            </button>
          </div>
        );

      default:
        return (
          <div className="preview-placeholder">
            <span className="placeholder-icon">📄</span>
            <p>Preview not available for this file type</p>
          </div>
        );
    }
  };

  return (
    <div className="media-preview-overlay" onClick={handleBackdropClick}>
      <div className="media-preview-modal">
        {/* Header */}
        <div className="preview-header">
          <div className="header-info">
            <span className="file-name">{file.name}</span>
            <span className="file-meta">
              {file.size_human} • {file.tierStatus?.toUpperCase()}
            </span>
          </div>
          <div className="header-actions">
            {mediaType === 'image' && (
              <>
                <button
                  onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
                  title="Zoom out"
                >
                  −
                </button>
                <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
                  title="Zoom in"
                >
                  +
                </button>
                <button
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  title="Reset"
                >
                  ⟳
                </button>
              </>
            )}
            <button
              onClick={() => setShowInfo(!showInfo)}
              title="Info"
              className={showInfo ? 'active' : ''}
            >
              ℹ️
            </button>
            {onDownload && (
              <button onClick={onDownload} title="Download">
                ⬇️
              </button>
            )}
            <button onClick={onClose} title="Close" className="btn-close">
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="preview-content">
          {isLoading && (
            <div className="preview-loading">
              <div className="loading-spinner" />
              <span>Loading preview...</span>
            </div>
          )}
          {renderContent()}
        </div>

        {/* Thumbnail timeline (for video) */}
        {mediaType === 'video' && thumbnails.length > 0 && (
          <div className="thumbnail-timeline">
            {thumbnails.map((thumb, index) => (
              <button
                key={index}
                className={`thumbnail-item ${currentThumbnail === index ? 'active' : ''}`}
                onClick={() => setCurrentThumbnail(index)}
              >
                <img src={thumb} alt={`Thumbnail ${index + 1}`} />
              </button>
            ))}
          </div>
        )}

        {/* Info panel */}
        {showInfo && (
          <div className="info-panel">
            <h3>File Information</h3>
            <dl>
              <dt>Name</dt>
              <dd>{file.name}</dd>
              <dt>Path</dt>
              <dd>{file.path}</dd>
              <dt>Size</dt>
              <dd>{file.size_human}</dd>
              <dt>Modified</dt>
              <dd>{file.lastModified}</dd>
              <dt>Tier</dt>
              <dd>{file.tierStatus}</dd>
              <dt>Cached</dt>
              <dd>{file.isCached ? 'Yes' : 'No'}</dd>
              {file.transcodeStatus && (
                <>
                  <dt>Transcode Status</dt>
                  <dd>{file.transcodeStatus}</dd>
                </>
              )}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

export default MediaPreviewModal;
