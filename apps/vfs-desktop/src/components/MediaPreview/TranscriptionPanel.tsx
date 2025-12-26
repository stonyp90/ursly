/**
 * Transcription Panel Component
 *
 * A beautiful, feature-rich transcription panel with:
 * - Real-time transcription display
 * - Search functionality
 * - Clickable timestamps for navigation
 * - Export options
 * - Beautiful animations
 * - Progress tracking
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { TranscriptionSegment } from './HlsVideoPlayer';
import './MediaPreview.css';

// Touch gesture handler for mobile
const useSwipeGesture = (
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
) => {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchEnd = useRef<{ x: number; y: number } | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    };
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;

    const distanceX = touchStart.current.x - touchEnd.current.x;
    const distanceY = touchStart.current.y - touchEnd.current.y;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;
    const isUpSwipe = distanceY > minSwipeDistance;
    const isDownSwipe = distanceY < -minSwipeDistance;

    if (isLeftSwipe && onSwipeLeft) {
      onSwipeLeft();
    }
    if (isRightSwipe && onSwipeRight) {
      onSwipeRight();
    }
    if (isUpSwipe && onSwipeUp) {
      onSwipeUp();
    }
    if (isDownSwipe && onSwipeDown) {
      onSwipeDown();
    }
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
};

export interface TranscriptionPanelProps {
  segments: TranscriptionSegment[];
  currentTime: number;
  onSeek: (time: number) => void;
  onClose?: () => void;
  isActive: boolean;
  progress?: number;
}

export function TranscriptionPanel({
  segments,
  currentTime,
  onSeek,
  onClose,
  isActive,
  progress = 0,
}: TranscriptionPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<'srt' | 'vtt' | 'txt'>(
    'srt',
  );
  const [isExporting, setIsExporting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Detect mobile/tablet
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Swipe gesture for mobile
  const swipeHandlers = useSwipeGesture(
    undefined, // swipe up
    onClose || undefined, // swipe down to close
    onClose || undefined, // swipe left to close
    undefined, // swipe right
  );

  // Filter segments by search query
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const query = searchQuery.toLowerCase();
    return segments.filter((seg) => seg.text.toLowerCase().includes(query));
  }, [segments, searchQuery]);

  // Find current active segment
  const activeSegmentIndex = useMemo(() => {
    return segments.findIndex(
      (seg) => currentTime >= seg.start_time && currentTime <= seg.end_time,
    );
  }, [segments, currentTime]);

  // Scroll to active segment
  useEffect(() => {
    if (activeSegmentRef.current && containerRef.current) {
      const container = containerRef.current;
      const active = activeSegmentRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();

      if (
        activeRect.top < containerRect.top ||
        activeRect.bottom > containerRect.bottom
      ) {
        active.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeSegmentIndex]);

  // Format time for display
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor(((seconds % 60) - secs) * 1000);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Export transcription
  const handleExport = async () => {
    setIsExporting(true);
    try {
      let content = '';

      switch (selectedFormat) {
        case 'srt':
          content = segments
            .map(
              (seg, index) =>
                `${index + 1}\n${formatTime(seg.start_time).replace('.', ',')} --> ${formatTime(seg.end_time).replace('.', ',')}\n${seg.text}\n\n`,
            )
            .join('');
          break;
        case 'vtt':
          content = `WEBVTT\n\n${segments
            .map(
              (seg) =>
                `${formatTime(seg.start_time)} --> ${formatTime(seg.end_time)}\n${seg.text}\n\n`,
            )
            .join('')}`;
          break;
        case 'txt':
          content = segments.map((seg) => seg.text).join(' ');
          break;
      }

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcription.${selectedFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    const text = segments.map((seg) => seg.text).join(' ');
    try {
      await navigator.clipboard.writeText(text);
      // Show feedback
      const btn = document.querySelector('.transcription-btn-icon');
      if (btn) {
        const original = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => {
          btn.textContent = original;
        }, 2000);
      }
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;

      // Escape to close
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
      // Cmd/Ctrl+F to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        const input = document.querySelector(
          '.transcription-search-input',
        ) as HTMLInputElement;
        input?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onClose]);

  if (!isActive && segments.length === 0) return null;

  return (
    <div
      ref={panelRef}
      className={`transcription-panel ${isActive ? 'active' : ''} ${isMobile ? 'mobile' : ''}`}
      {...(isMobile ? swipeHandlers : {})}
    >
      {/* Mobile drag handle */}
      {isMobile && (
        <div className="transcription-drag-handle">
          <div className="transcription-drag-handle-bar" />
        </div>
      )}

      {/* Header */}
      <div className="transcription-header">
        <div className="transcription-header-left">
          <h3>
            <span className="transcription-icon">🎙️</span>
            <span className="transcription-title">
              Transcription
              {segments.length > 0 && !isMobile && (
                <span className="segment-count">
                  ({segments.length} segments)
                </span>
              )}
            </span>
          </h3>
          {progress > 0 && progress < 1 && (
            <div className="transcription-progress-bar">
              <div
                className="transcription-progress-fill"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}
        </div>
        <div className="transcription-header-actions">
          {segments.length > 0 && (
            <>
              {!isMobile && (
                <button
                  onClick={handleCopy}
                  className="transcription-btn-icon"
                  title="Copy to clipboard"
                >
                  📋
                </button>
              )}
              {isMobile ? (
                <div className="transcription-mobile-actions">
                  <button
                    onClick={handleCopy}
                    className="transcription-btn-mobile"
                    title="Copy"
                  >
                    📋
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="transcription-btn-mobile"
                    title="Export"
                  >
                    {isExporting ? '⏳' : '💾'}
                  </button>
                </div>
              ) : (
                <>
                  <select
                    value={selectedFormat}
                    onChange={(e) =>
                      setSelectedFormat(e.target.value as 'srt' | 'vtt' | 'txt')
                    }
                    className="transcription-format-select"
                  >
                    <option value="srt">SRT</option>
                    <option value="vtt">VTT</option>
                    <option value="txt">TXT</option>
                  </select>
                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="transcription-btn-export"
                  >
                    {isExporting ? '⏳' : '💾'} Export
                  </button>
                </>
              )}
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="transcription-btn-close"
              title="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Mobile format selector */}
      {isMobile && segments.length > 0 && (
        <div className="transcription-mobile-format">
          <select
            value={selectedFormat}
            onChange={(e) =>
              setSelectedFormat(e.target.value as 'srt' | 'vtt' | 'txt')
            }
            className="transcription-format-select-mobile"
          >
            <option value="srt">SRT</option>
            <option value="vtt">VTT</option>
            <option value="txt">TXT</option>
          </select>
        </div>
      )}

      {/* Search */}
      {segments.length > 0 && (
        <div className="transcription-search">
          <input
            type="text"
            placeholder="Search transcription..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="transcription-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="transcription-search-clear"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Segments List */}
      <div className="transcription-segments" ref={containerRef}>
        {segments.length === 0 ? (
          <div className="transcription-empty">
            <div className="transcription-empty-icon">🎬</div>
            <p>No transcription yet</p>
            <span>Transcription will appear here as it's generated</span>
          </div>
        ) : filteredSegments.length === 0 ? (
          <div className="transcription-empty">
            <div className="transcription-empty-icon">🔍</div>
            <p>No results found</p>
            <span>Try a different search query</span>
          </div>
        ) : (
          filteredSegments.map((segment, index) => {
            const isActive = index === activeSegmentIndex;
            const isHighlighted = searchQuery
              ? segment.text.toLowerCase().includes(searchQuery.toLowerCase())
              : false;

            return (
              <div
                key={index}
                ref={isActive ? activeSegmentRef : null}
                className={`transcription-segment ${isActive ? 'active' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                onClick={() => onSeek(segment.start_time)}
              >
                <div className="transcription-segment-time">
                  {formatTime(segment.start_time)}
                </div>
                <div className="transcription-segment-text">{segment.text}</div>
                {segment.confidence !== undefined && (
                  <div className="transcription-segment-confidence">
                    {Math.round(segment.confidence * 100)}%
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default TranscriptionPanel;
