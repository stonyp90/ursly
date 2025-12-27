/**
 * UploadStatusWidget Component
 *
 * Compact widget showing upload progress and recent completions
 * Designed to be integrated into the FS view sidebar
 */
import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './UploadStatusWidget.css';

interface UploadState {
  upload_id: string;
  source_id: string;
  key: string;
  local_path: string;
  total_size: number;
  bytes_uploaded: number;
  current_part: number;
  total_parts: number;
  status:
    | 'Pending'
    | 'InProgress'
    | 'Paused'
    | 'Completed'
    | 'Failed'
    | 'Canceled';
  error?: string;
  speed_bytes_per_sec?: number;
  eta_seconds?: number;
}

export const UploadStatusWidget: React.FC = () => {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [recentCompletions, setRecentCompletions] = useState<UploadState[]>([]);

  const loadUploads = useCallback(async () => {
    try {
      const uploadList = await invoke<UploadState[]>('vfs_list_uploads');
      setUploads(uploadList);

      // Track recent completions (last 5 completed uploads, max 5 minutes old)
      const now = Date.now();
      const recent = uploadList
        .filter((u) => u.status === 'Completed')
        .slice(-5)
        .filter((u) => {
          // Keep completions for 5 minutes
          return true; // We'll track by keeping last 5
        });
      setRecentCompletions(recent);
    } catch (err) {
      console.error('Failed to load uploads:', err);
    }
  }, []);

  useEffect(() => {
    loadUploads();
    const interval = setInterval(loadUploads, 2000);
    return () => clearInterval(interval);
  }, [loadUploads]);

  const activeUploads = uploads.filter(
    (u) =>
      u.status === 'InProgress' ||
      u.status === 'Pending' ||
      u.status === 'Paused',
  );

  const failedUploads = uploads.filter((u) => u.status === 'Failed');

  const hasAnyUploads =
    activeUploads.length > 0 ||
    failedUploads.length > 0 ||
    recentCompletions.length > 0;

  if (!hasAnyUploads) {
    return null;
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatTime = (seconds?: number): string => {
    if (!seconds || seconds < 0) return '';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const getFileName = (upload: UploadState): string => {
    return (
      upload.key.split('/').pop() ||
      upload.local_path.split('/').pop() ||
      'Unknown'
    );
  };

  const getProgressPercentage = (upload: UploadState): number => {
    if (upload.total_size === 0) return 0;
    return Math.round((upload.bytes_uploaded / upload.total_size) * 100);
  };

  const handleRetry = async (uploadId: string, sourceId: string) => {
    try {
      await invoke('vfs_resume_upload', { uploadId, sourceId });
      // Reload uploads to reflect the status change
      setTimeout(() => {
        loadUploads();
      }, 500);
    } catch (err) {
      console.error('Failed to retry upload:', err);
    }
  };

  return (
    <div className="upload-status-widget">
      <button
        className="upload-status-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="upload-status-header-content">
          <svg
            className="upload-status-icon"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
            <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z" />
          </svg>
          <span className="upload-status-title">Uploads</span>
          {activeUploads.length > 0 && (
            <span className="upload-status-badge">{activeUploads.length}</span>
          )}
        </div>
        <svg
          className={`upload-status-chevron ${isExpanded ? 'expanded' : ''}`}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="upload-status-content">
          {/* Active Uploads */}
          {activeUploads.length > 0 && (
            <div className="upload-status-section">
              <div className="upload-status-section-header">Active</div>
              {activeUploads.map((upload) => {
                const fileName = getFileName(upload);
                const percentage = getProgressPercentage(upload);
                return (
                  <div key={upload.upload_id} className="upload-status-item">
                    <div className="upload-status-item-header">
                      <span className="upload-status-filename" title={fileName}>
                        {fileName}
                      </span>
                      <span className="upload-status-percentage">
                        {percentage}%
                      </span>
                    </div>
                    <div className="upload-status-progress-bar">
                      <div
                        className="upload-status-progress-fill"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="upload-status-item-details">
                      <span>
                        {formatBytes(upload.bytes_uploaded)} /{' '}
                        {formatBytes(upload.total_size)}
                      </span>
                      {upload.speed_bytes_per_sec && (
                        <>
                          <span className="upload-status-separator">•</span>
                          <span>
                            {formatBytes(upload.speed_bytes_per_sec)}/s
                          </span>
                        </>
                      )}
                      {upload.eta_seconds && (
                        <>
                          <span className="upload-status-separator">•</span>
                          <span>{formatTime(upload.eta_seconds)} left</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Failed Uploads */}
          {failedUploads.length > 0 && (
            <div className="upload-status-section">
              <div className="upload-status-section-header">Failed</div>
              {failedUploads.map((upload) => {
                const fileName = getFileName(upload);
                const percentage = getProgressPercentage(upload);
                return (
                  <div
                    key={upload.upload_id}
                    className="upload-status-item upload-status-item-failed"
                  >
                    <div className="upload-status-item-header">
                      <span className="upload-status-filename" title={fileName}>
                        {fileName}
                      </span>
                      <button
                        className="upload-status-retry-btn"
                        onClick={() =>
                          handleRetry(upload.upload_id, upload.source_id)
                        }
                        title="Retry upload"
                      >
                        <svg
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className="upload-status-retry-icon"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"
                          />
                          <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
                        </svg>
                        Retry
                      </button>
                    </div>
                    {upload.error && (
                      <div className="upload-status-error-message">
                        {upload.error}
                      </div>
                    )}
                    <div className="upload-status-progress-bar">
                      <div
                        className="upload-status-progress-fill upload-status-progress-failed"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="upload-status-item-details">
                      <span>
                        {formatBytes(upload.bytes_uploaded)} /{' '}
                        {formatBytes(upload.total_size)}
                      </span>
                      {percentage > 0 && (
                        <>
                          <span className="upload-status-separator">•</span>
                          <span>{percentage}% uploaded</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent Completions */}
          {recentCompletions.length > 0 && (
            <div className="upload-status-section">
              <div className="upload-status-section-header">Completed</div>
              {recentCompletions.map((upload) => {
                const fileName = getFileName(upload);
                return (
                  <div
                    key={upload.upload_id}
                    className="upload-status-item upload-status-item-completed"
                  >
                    <div className="upload-status-item-header">
                      <span className="upload-status-filename" title={fileName}>
                        {fileName}
                      </span>
                      <svg
                        className="upload-status-success-icon"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                      >
                        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                      </svg>
                    </div>
                    <div className="upload-status-item-details">
                      <span>{formatBytes(upload.total_size)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UploadStatusWidget;
