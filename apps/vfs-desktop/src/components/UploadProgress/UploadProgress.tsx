/**
 * UploadProgress Component
 *
 * Displays progress for S3 multipart uploads with:
 * - Progress bar
 * - Speed and ETA
 * - Pause/Resume/Cancel controls
 * - Clean, modern UI
 */
import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './UploadProgress.css';

export interface UploadProgressData {
  upload_id: string;
  key: string;
  bytes_uploaded: number;
  total_size: number;
  percentage: number;
  current_part: number;
  total_parts: number;
  status: 'Pending' | 'InProgress' | 'Completed' | 'Failed' | 'Paused';
  speed_bytes_per_sec?: number;
  estimated_time_remaining_sec?: number;
}

interface UploadProgressProps {
  uploadId: string;
  fileName: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({
  uploadId,
  fileName,
  onComplete,
  onCancel,
}) => {
  const [progress, setProgress] = useState<UploadProgressData | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Poll for progress updates
    const interval = setInterval(async () => {
      try {
        const progressData = await invoke<UploadProgressData | null>(
          'vfs_get_upload_progress',
          { uploadId },
        );
        if (progressData) {
          setProgress(progressData);
          setIsPaused(progressData.status === 'Paused');

          if (progressData.status === 'Completed' && onComplete) {
            onComplete();
          }
        }
      } catch (err) {
        console.error('Failed to get upload progress:', err);
      }
    }, 500); // Update every 500ms

    return () => clearInterval(interval);
  }, [uploadId, onComplete]);

  const handlePause = async () => {
    try {
      await invoke('vfs_pause_upload', { uploadId });
      setIsPaused(true);
    } catch (err) {
      console.error('Failed to pause upload:', err);
    }
  };

  const handleResume = async () => {
    try {
      await invoke('vfs_resume_upload', { uploadId });
      setIsPaused(false);
    } catch (err) {
      console.error('Failed to resume upload:', err);
    }
  };

  const handleCancel = async () => {
    try {
      await invoke('vfs_cancel_upload', { uploadId });
      if (onCancel) {
        onCancel();
      }
    } catch (err) {
      console.error('Failed to cancel upload:', err);
    }
  };

  if (!progress) {
    return (
      <div className="upload-progress">
        <div className="upload-progress-loading">Loading...</div>
      </div>
    );
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSec?: number): string => {
    if (!bytesPerSec) return '—';
    return `${formatBytes(bytesPerSec)}/s`;
  };

  const formatTime = (seconds?: number): string => {
    if (!seconds) return '—';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusColor = (): string => {
    switch (progress.status) {
      case 'Completed':
        return 'var(--vfs-success, #30d158)';
      case 'Failed':
        return 'var(--vfs-error, #ff453a)';
      case 'Paused':
        return 'var(--vfs-warning, #ff9f0a)';
      default:
        return 'var(--vfs-primary, #6366f1)';
    }
  };

  return (
    <div className="upload-progress">
      <div className="upload-progress-header">
        <div className="upload-progress-info">
          <div className="upload-progress-filename" title={fileName}>
            {fileName}
          </div>
          <div className="upload-progress-stats">
            <span>
              {formatBytes(progress.bytes_uploaded)} /{' '}
              {formatBytes(progress.total_size)}
            </span>
            <span className="upload-progress-separator">•</span>
            <span>{progress.percentage.toFixed(1)}%</span>
            {progress.speed_bytes_per_sec && (
              <>
                <span className="upload-progress-separator">•</span>
                <span>{formatSpeed(progress.speed_bytes_per_sec)}</span>
              </>
            )}
            {progress.estimated_time_remaining_sec && (
              <>
                <span className="upload-progress-separator">•</span>
                <span>
                  {formatTime(progress.estimated_time_remaining_sec)} remaining
                </span>
              </>
            )}
          </div>
        </div>
        <div className="upload-progress-actions">
          {progress.status === 'InProgress' && !isPaused && (
            <button
              className="upload-progress-btn pause"
              onClick={handlePause}
              aria-label="Pause upload"
            >
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M6 3.5a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5V4a.5.5 0 0 0-.5-.5H6zm4 0a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5V4a.5.5 0 0 0-.5-.5h-2z" />
              </svg>
            </button>
          )}
          {isPaused && (
            <button
              className="upload-progress-btn resume"
              onClick={handleResume}
              aria-label="Resume upload"
            >
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                <path d="M6.271 5.055a.5.5 0 0 1 .475.052l3.5 2a.5.5 0 0 1 0 .886l-3.5 2A.5.5 0 0 1 6 10V6a.5.5 0 0 1 .271-.945z" />
              </svg>
            </button>
          )}
          {progress.status !== 'Completed' && (
            <button
              className="upload-progress-btn cancel"
              onClick={handleCancel}
              aria-label="Cancel upload"
            >
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="upload-progress-bar-container">
        <div
          className="upload-progress-bar"
          style={{
            width: `${progress.percentage}%`,
            backgroundColor: getStatusColor(),
          }}
        />
      </div>

      {progress.status === 'Failed' && progress.error && (
        <div className="upload-progress-error">{progress.error}</div>
      )}

      {progress.status === 'Completed' && (
        <div className="upload-progress-success">
          Upload completed successfully
        </div>
      )}
    </div>
  );
};

export default UploadProgress;
