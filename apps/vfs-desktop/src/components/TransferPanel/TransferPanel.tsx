/**
 * TransferPanel Component (Operations Panel)
 *
 * Comprehensive operations management panel showing:
 * - Active uploads, downloads, and other operations
 * - Operation history with storage type information
 * - Pause/Resume/Cancel controls
 * - Progress tracking
 */

import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './TransferPanel.css';

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
  estimated_time_remaining_sec?: number;
  created_at?: string;
  completed_at?: string;
  last_updated_at?: string;
}

interface DownloadState {
  download_id: string;
  source_id: string;
  source_path: string;
  destination_path: string;
  total_size: number;
  bytes_downloaded: number;
  status:
    | 'Pending'
    | 'InProgress'
    | 'Paused'
    | 'Completed'
    | 'Failed'
    | 'Canceled';
  error?: string;
  speed_bytes_per_sec?: number;
  estimated_time_remaining_sec?: number;
  created_at?: string;
  completed_at?: string;
  last_updated_at?: string;
}

interface OperationState {
  operation_id: string;
  operation_type: 'Upload' | 'Download' | 'Delete' | 'Move' | 'Copy';
  source_id: string;
  source_path: string;
  destination_path?: string;
  file_size?: number;
  bytes_processed: number;
  status: 'Pending' | 'InProgress' | 'Completed' | 'Failed' | 'Canceled';
  error?: string;
  created_at?: string;
  completed_at?: string;
  last_updated_at?: string;
}

interface StorageSourceInfo {
  id: string;
  name: string;
  providerId: string;
  category: string;
  source_type?: string;
}

interface TransferPanelProps {
  isVisible: boolean;
  onClose?: () => void;
  onMinimizeChange?: (isMinimized: boolean) => void;
  // Filter operations by source category
  filterSources?: ('network' | 'cloud')[];
  // Storage sources for displaying provider info
  sources?: StorageSourceInfo[];
}

export const TransferPanel: React.FC<TransferPanelProps> = ({
  isVisible,
  onClose,
  onMinimizeChange,
  filterSources = ['network', 'cloud'], // Default: only network and cloud
  sources = [],
}) => {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [downloads, setDownloads] = useState<DownloadState[]>([]);
  const [operations, setOperations] = useState<OperationState[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [isMinimized, setIsMinimized] = useState(false);

  const handleMinimizeToggle = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    if (onMinimizeChange) {
      onMinimizeChange(newState);
    }
  };

  const loadUploads = useCallback(async () => {
    try {
      const uploadList = await invoke<UploadState[]>('vfs_list_uploads');
      // Filter uploads by source category (only network and cloud)
      const filtered = (uploadList || []).filter((upload) => {
        // We need to check the source_id against available sources
        // For now, we'll filter based on source_id patterns or load sources
        // This will be handled by filtering operations instead
        return true; // Will filter via operations
      });
      setUploads(filtered);
    } catch (err) {
      console.error('Failed to load uploads:', err);
      // Set empty array on error to prevent rendering issues
      setUploads([]);
    }
  }, [filterSources]);

  const loadDownloads = useCallback(async () => {
    try {
      // TODO: Implement vfs_list_downloads command
      // For now, we'll track downloads in local state
      // const downloadList = await invoke<DownloadState[]>('vfs_list_downloads');
      // setDownloads(downloadList || []);
      setDownloads([]);
    } catch (err) {
      console.error('Failed to load downloads:', err);
      // Set empty array on error to prevent rendering issues
      setDownloads([]);
    }
  }, []);

  const loadOperations = useCallback(async () => {
    try {
      const operationList = await invoke<OperationState[]>(
        'vfs_list_operations',
      );
      // Filter operations by source category
      // We need to get sources to check categories
      const sources =
        await invoke<Array<{ id: string; source_type: string }>>(
          'vfs_list_sources',
        );

      // Map source types to categories
      const sourceCategoryMap = new Map<string, string>();
      sources.forEach((s: any) => {
        const category = mapSourceTypeToCategory(s.source_type);
        sourceCategoryMap.set(s.id, category);
      });

      const filtered = (operationList || []).filter((op) => {
        const category = sourceCategoryMap.get(op.source_id) || 'local';
        return filterSources.includes(category as 'network' | 'cloud');
      });

      setOperations(filtered);
    } catch (err) {
      console.error('Failed to load operations:', err);
      setOperations([]);
    }
  }, [filterSources]);

  // Helper function to map source type to category
  const mapSourceTypeToCategory = (sourceType: string): string => {
    const mapping: Record<string, string> = {
      Local: 'local',
      S3: 'cloud',
      Gcs: 'cloud',
      AzureBlob: 'cloud',
      S3Compatible: 'cloud',
      Nfs: 'network',
      Smb: 'network',
      Nas: 'network',
      Sftp: 'network',
      WebDav: 'network',
    };
    return mapping[sourceType] || 'local';
  };

  // Helper function to get storage provider info for a source_id
  const getStorageInfo = (
    sourceId: string,
  ): { name: string; provider: string; category: string } => {
    const source = sources.find((s) => s.id === sourceId);
    if (source) {
      return {
        name: source.name || 'Unknown',
        provider: source.providerId || source.source_type || 'unknown',
        category: source.category || 'unknown',
      };
    }
    return { name: 'Unknown', provider: 'unknown', category: 'unknown' };
  };

  // Helper function to format provider name
  const formatProviderName = (provider: string): string => {
    const providerMap: Record<string, string> = {
      'aws-s3': 'AWS S3',
      s3: 'AWS S3',
      gcs: 'Google Cloud Storage',
      'azure-blob': 'Azure Blob',
      nfs: 'NFS',
      smb: 'SMB',
      sftp: 'SFTP',
      webdav: 'WebDAV',
    };
    return providerMap[provider.toLowerCase()] || provider;
  };

  useEffect(() => {
    if (isVisible) {
      loadUploads();
      loadDownloads();
      loadOperations();
      const interval = setInterval(() => {
        loadUploads();
        loadDownloads();
        loadOperations();
      }, 1000);
      return () => clearInterval(interval);
    } else {
      // Clear uploads/downloads/operations when panel is hidden to prevent stale data
      setUploads([]);
      setDownloads([]);
      setOperations([]);
    }
  }, [isVisible, loadUploads, loadDownloads, loadOperations]);

  const handlePauseUpload = async (uploadId: string) => {
    try {
      await invoke('vfs_pause_upload', { uploadId });
      loadUploads();
    } catch (err) {
      console.error('Failed to pause upload:', err);
    }
  };

  const handleResumeUpload = async (uploadId: string, sourceId: string) => {
    try {
      await invoke('vfs_resume_upload', { uploadId, sourceId });
      loadUploads();
    } catch (err) {
      console.error('Failed to resume upload:', err);
    }
  };

  const handleCancelUpload = async (uploadId: string) => {
    try {
      await invoke('vfs_cancel_upload', { uploadId });
      loadUploads();
    } catch (err) {
      console.error('Failed to cancel upload:', err);
    }
  };

  const formatBytes = (bytes: number | undefined | null): string => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatTime = (seconds?: number | null): string => {
    if (!seconds || seconds < 0 || isNaN(seconds)) return '';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const formatTimestamp = (timestamp?: string | null): string => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString();
    } catch {
      return '';
    }
  };

  const getProgressPercentage = (
    bytes: number | undefined | null,
    total: number | undefined | null,
  ): number => {
    if (!bytes || !total || total === 0 || isNaN(bytes) || isNaN(total))
      return 0;
    const percentage = Math.round((bytes / total) * 100);
    return Math.min(100, Math.max(0, percentage));
  };

  const getFileName = (path: string | undefined | null): string => {
    if (!path) return 'Unknown';
    // Cross-platform path handling: support both Unix (/) and Windows (\) separators
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || 'Unknown';
  };

  // Filter uploads by source category - match with operations that have matching source_ids
  const operationSourceIds = new Set(
    operations
      .filter((op) => {
        // Operations are already filtered by category in loadOperations
        return op && filterSources;
      })
      .map((op) => op.source_id),
  );

  const filteredUploads = (uploads || []).filter((upload) => {
    // Include uploads that match operation source_ids (network/cloud)
    return operationSourceIds.has(upload.source_id);
  });

  // Defensive filtering with null checks
  const activeUploads = (filteredUploads || []).filter(
    (u) =>
      u &&
      (u.status === 'InProgress' ||
        u.status === 'Pending' ||
        u.status === 'Paused'),
  );

  const activeDownloads = (downloads || []).filter(
    (d) =>
      d &&
      (d.status === 'InProgress' ||
        d.status === 'Pending' ||
        d.status === 'Paused'),
  );

  const completedUploads = (filteredUploads || [])
    .filter((u) => u && (u.status === 'Completed' || u.status === 'Failed'))
    .sort((a, b) => {
      const aTime = (
        a.completed_at ||
        a.last_updated_at ||
        a.created_at ||
        ''
      ).toString();
      const bTime = (
        b.completed_at ||
        b.last_updated_at ||
        b.created_at ||
        ''
      ).toString();
      return bTime.localeCompare(aTime);
    })
    .slice(0, 10); // Reduced history size

  const completedDownloads = (downloads || [])
    .filter((d) => d && (d.status === 'Completed' || d.status === 'Failed'))
    .sort((a, b) => {
      const aTime = (
        a.completed_at ||
        a.last_updated_at ||
        a.created_at ||
        ''
      ).toString();
      const bTime = (
        b.completed_at ||
        b.last_updated_at ||
        b.created_at ||
        ''
      ).toString();
      return bTime.localeCompare(aTime);
    })
    .slice(0, 10); // Reduced history size

  // Extract downloads and deletes from operations
  const operationDownloads = (operations || [])
    .filter((op) => op && op.operation_type === 'Download')
    .map((op) => ({
      download_id: op.operation_id,
      source_id: op.source_id,
      source_path: op.source_path,
      destination_path: op.destination_path || '',
      total_size: op.file_size || op.bytes_processed,
      bytes_downloaded: op.bytes_processed,
      status: op.status as
        | 'Pending'
        | 'InProgress'
        | 'Paused'
        | 'Completed'
        | 'Failed'
        | 'Canceled',
      error: op.error,
      created_at: op.created_at,
      completed_at: op.completed_at,
      last_updated_at: op.last_updated_at,
    }));

  const deleteOperations = (operations || [])
    .filter((op) => op && op.operation_type === 'Delete')
    .sort((a, b) => {
      const aTime = (
        a.completed_at ||
        a.last_updated_at ||
        a.created_at ||
        ''
      ).toString();
      const bTime = (
        b.completed_at ||
        b.last_updated_at ||
        b.created_at ||
        ''
      ).toString();
      return bTime.localeCompare(aTime);
    })
    .slice(0, 10); // Reduced history size

  // Ensure arrays are always defined
  const safeActiveUploads = activeUploads || [];
  const activeOperationDownloads = operationDownloads.filter(
    (d) => d.status === 'InProgress' || d.status === 'Pending',
  );
  const safeActiveDownloads =
    activeDownloads.length > 0 || activeOperationDownloads.length > 0
      ? [...activeDownloads, ...activeOperationDownloads]
      : [];
  const safeCompletedUploads = completedUploads || [];
  const completedOperationDownloads = operationDownloads.filter(
    (d) => d.status === 'Completed' || d.status === 'Failed',
  );
  const safeCompletedDownloads =
    completedDownloads.length > 0 || completedOperationDownloads.length > 0
      ? [...completedDownloads, ...completedOperationDownloads]
      : [];

  const activeCount = safeActiveUploads.length + safeActiveDownloads.length;
  const hasActiveTransfers = activeCount > 0;

  return (
    <div className={`transfer-panel ${isMinimized ? 'minimized' : ''}`}>
      <div className="transfer-panel-header">
        <div className="transfer-panel-header-left">
          <h3>Operations</h3>
          {hasActiveTransfers && (
            <span className="transfer-panel-badge">{activeCount}</span>
          )}
        </div>
        <div className="transfer-panel-header-right">
          <button
            className="transfer-panel-minimize"
            onClick={handleMinimizeToggle}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? (
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                width="16"
                height="16"
              >
                <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                width="16"
                height="16"
              >
                <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z" />
              </svg>
            )}
          </button>
          {onClose && (
            <button
              className="transfer-panel-close"
              onClick={onClose}
              title="Close"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {isMinimized ? (
        <div className="transfer-panel-minimized-content">
          {hasActiveTransfers ? (
            <div className="transfer-panel-minimized-info">
              <span>
                {activeCount} active transfer{activeCount !== 1 ? 's' : ''}
              </span>
              <button
                className="transfer-panel-expand-btn"
                onClick={handleMinimizeToggle}
              >
                Expand
              </button>
            </div>
          ) : (
            <div className="transfer-panel-minimized-info">
              <span>No active transfers</span>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="transfer-panel-tabs">
            <button
              className={`transfer-tab ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
            >
              Active ({safeActiveUploads.length + safeActiveDownloads.length})
            </button>
            <button
              className={`transfer-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              History (
              {safeCompletedUploads.length + safeCompletedDownloads.length})
            </button>
          </div>

          <div className="transfer-panel-content">
            {activeTab === 'active' ? (
              <>
                {/* Active Uploads */}
                {safeActiveUploads.length > 0 && (
                  <div className="transfer-section">
                    <h4 className="transfer-section-title">Uploading</h4>
                    {safeActiveUploads
                      .map((upload) => {
                        if (!upload || !upload.upload_id) return null;
                        const percentage = getProgressPercentage(
                          upload.bytes_uploaded,
                          upload.total_size,
                        );
                        const fileName = getFileName(upload.key);
                        const storageInfo = getStorageInfo(upload.source_id);
                        return (
                          <div
                            key={upload.upload_id}
                            className="transfer-item transfer-item-compact"
                          >
                            <div className="transfer-item-header">
                              <div className="transfer-item-name-row">
                                <span
                                  className="transfer-item-name"
                                  title={fileName}
                                >
                                  {fileName}
                                </span>
                                <span
                                  className="transfer-item-storage-badge"
                                  title={`${storageInfo.name} (${formatProviderName(storageInfo.provider)})`}
                                >
                                  {formatProviderName(storageInfo.provider)}
                                </span>
                              </div>
                              <span className="transfer-item-percentage">
                                {percentage}%
                              </span>
                            </div>
                            <div className="transfer-progress-bar">
                              <div
                                className="transfer-progress-fill"
                                style={{
                                  width: `${Math.min(100, Math.max(0, percentage))}%`,
                                }}
                              />
                            </div>
                            <div className="transfer-item-details">
                              <span>
                                {formatBytes(upload.bytes_uploaded)} /{' '}
                                {formatBytes(upload.total_size)}
                              </span>
                              {upload.speed_bytes_per_sec && (
                                <>
                                  <span className="transfer-separator">•</span>
                                  <span>
                                    {formatBytes(upload.speed_bytes_per_sec)}/s
                                  </span>
                                </>
                              )}
                              {upload.estimated_time_remaining_sec && (
                                <>
                                  <span className="transfer-separator">•</span>
                                  <span>
                                    {formatTime(
                                      upload.estimated_time_remaining_sec,
                                    )}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="transfer-item-actions">
                              {upload.status === 'Paused' ? (
                                <button
                                  className="transfer-action-btn compact"
                                  onClick={() =>
                                    upload.source_id &&
                                    handleResumeUpload(
                                      upload.upload_id,
                                      upload.source_id,
                                    )
                                  }
                                  title="Resume"
                                >
                                  ▶
                                </button>
                              ) : (
                                <button
                                  className="transfer-action-btn compact"
                                  onClick={() =>
                                    handlePauseUpload(upload.upload_id)
                                  }
                                  title="Pause"
                                >
                                  ⏸
                                </button>
                              )}
                              <button
                                className="transfer-action-btn compact danger"
                                onClick={() =>
                                  handleCancelUpload(upload.upload_id)
                                }
                                title="Cancel"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })
                      .filter(Boolean)}
                  </div>
                )}

                {/* Active Downloads */}
                {safeActiveDownloads.length > 0 && (
                  <div className="transfer-section">
                    <h4 className="transfer-section-title">Downloading</h4>
                    {safeActiveDownloads
                      .map((download) => {
                        if (!download || !download.download_id) return null;
                        const percentage = getProgressPercentage(
                          download.bytes_downloaded,
                          download.total_size,
                        );
                        const fileName = getFileName(download.source_path);
                        const hasSpeed =
                          'speed_bytes_per_sec' in download &&
                          download.speed_bytes_per_sec;
                        const hasETA =
                          'estimated_time_remaining_sec' in download &&
                          download.estimated_time_remaining_sec;
                        const storageInfo = getStorageInfo(download.source_id);
                        return (
                          <div
                            key={download.download_id}
                            className="transfer-item transfer-item-compact"
                          >
                            <div className="transfer-item-header">
                              <div className="transfer-item-name-row">
                                <span
                                  className="transfer-item-name"
                                  title={fileName}
                                >
                                  {fileName}
                                </span>
                                <span
                                  className="transfer-item-storage-badge"
                                  title={`${storageInfo.name} (${formatProviderName(storageInfo.provider)})`}
                                >
                                  {formatProviderName(storageInfo.provider)}
                                </span>
                              </div>
                              <span className="transfer-item-percentage">
                                {percentage}%
                              </span>
                            </div>
                            <div className="transfer-progress-bar">
                              <div
                                className="transfer-progress-fill download"
                                style={{
                                  width: `${Math.min(100, Math.max(0, percentage))}%`,
                                }}
                              />
                            </div>
                            <div className="transfer-item-details">
                              <span>
                                {formatBytes(download.bytes_downloaded)} /{' '}
                                {formatBytes(download.total_size)}
                              </span>
                              {hasSpeed && (
                                <>
                                  <span className="transfer-separator">•</span>
                                  <span>
                                    {formatBytes(download.speed_bytes_per_sec!)}
                                    /s
                                  </span>
                                </>
                              )}
                              {hasETA && (
                                <>
                                  <span className="transfer-separator">•</span>
                                  <span>
                                    {formatTime(
                                      download.estimated_time_remaining_sec!,
                                    )}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="transfer-item-actions">
                              {download.status === 'Paused' ? (
                                <button
                                  className="transfer-action-btn compact"
                                  onClick={() => {
                                    // TODO: Implement resume download
                                    console.log(
                                      'Resume download:',
                                      download.download_id,
                                    );
                                  }}
                                  title="Resume"
                                >
                                  ▶
                                </button>
                              ) : (
                                <button
                                  className="transfer-action-btn compact"
                                  onClick={() => {
                                    // TODO: Implement pause download
                                    console.log(
                                      'Pause download:',
                                      download.download_id,
                                    );
                                  }}
                                  title="Pause"
                                >
                                  ⏸
                                </button>
                              )}
                              <button
                                className="transfer-action-btn compact danger"
                                onClick={() => {
                                  // TODO: Implement cancel download
                                  console.log(
                                    'Cancel download:',
                                    download.download_id,
                                  );
                                }}
                                title="Cancel"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })
                      .filter(Boolean)}
                  </div>
                )}

                {safeActiveUploads.length === 0 &&
                  safeActiveDownloads.length === 0 && (
                    <div className="transfer-empty">
                      <p>No active transfers</p>
                    </div>
                  )}
              </>
            ) : (
              <>
                {/* Upload History */}
                {safeCompletedUploads.length > 0 && (
                  <div className="transfer-section">
                    <h4 className="transfer-section-title">Upload History</h4>
                    {safeCompletedUploads
                      .map((upload) => {
                        if (!upload || !upload.upload_id) return null;
                        const fileName = getFileName(upload.key);
                        const fileSize = upload.total_size || 0;
                        const storageInfo = getStorageInfo(upload.source_id);
                        return (
                          <div
                            key={upload.upload_id}
                            className={`transfer-item transfer-item-completed transfer-item-compact ${upload.status === 'Failed' ? 'failed' : ''}`}
                          >
                            <div className="transfer-item-header">
                              <div className="transfer-item-name-row">
                                <span
                                  className="transfer-item-name"
                                  title={fileName}
                                >
                                  {fileName}
                                </span>
                                <span
                                  className="transfer-item-storage-badge"
                                  title={`${storageInfo.name} (${formatProviderName(storageInfo.provider)})`}
                                >
                                  {formatProviderName(storageInfo.provider)}
                                </span>
                              </div>
                              {upload.status === 'Completed' ? (
                                <span className="transfer-status-icon">✓</span>
                              ) : (
                                <span className="transfer-status-icon failed">
                                  ✕
                                </span>
                              )}
                            </div>
                            <div className="transfer-item-details">
                              <span>{formatBytes(fileSize)}</span>
                              {upload.completed_at && (
                                <>
                                  <span className="transfer-separator">•</span>
                                  <span>
                                    {formatTimestamp(upload.completed_at)}
                                  </span>
                                </>
                              )}
                            </div>
                            {upload.error && (
                              <div className="transfer-error">
                                {upload.error}
                              </div>
                            )}
                          </div>
                        );
                      })
                      .filter(Boolean)}
                  </div>
                )}

                {/* Download History */}
                {safeCompletedDownloads.length > 0 && (
                  <div className="transfer-section">
                    <h4 className="transfer-section-title">Download History</h4>
                    {safeCompletedDownloads
                      .map((download) => {
                        if (!download || !download.download_id) return null;
                        const fileName = getFileName(download.source_path);
                        const fileSize = download.total_size || 0;
                        const storageInfo = getStorageInfo(download.source_id);
                        return (
                          <div
                            key={download.download_id}
                            className={`transfer-item transfer-item-completed transfer-item-compact ${download.status === 'Failed' ? 'failed' : ''}`}
                          >
                            <div className="transfer-item-header">
                              <div className="transfer-item-name-row">
                                <span
                                  className="transfer-item-name"
                                  title={fileName}
                                >
                                  {fileName}
                                </span>
                                <span
                                  className="transfer-item-storage-badge"
                                  title={`${storageInfo.name} (${formatProviderName(storageInfo.provider)})`}
                                >
                                  {formatProviderName(storageInfo.provider)}
                                </span>
                              </div>
                              {download.status === 'Completed' ? (
                                <span className="transfer-status-icon">✓</span>
                              ) : (
                                <span className="transfer-status-icon failed">
                                  ✕
                                </span>
                              )}
                            </div>
                            <div className="transfer-item-details">
                              <span>{formatBytes(fileSize)}</span>
                              {download.completed_at && (
                                <>
                                  <span className="transfer-separator">•</span>
                                  <span>
                                    {formatTimestamp(download.completed_at)}
                                  </span>
                                </>
                              )}
                            </div>
                            {download.error && (
                              <div className="transfer-error">
                                {download.error}
                              </div>
                            )}
                          </div>
                        );
                      })
                      .filter(Boolean)}
                  </div>
                )}

                {/* Delete Operations History */}
                {deleteOperations.length > 0 && (
                  <div className="transfer-section">
                    <h4 className="transfer-section-title">Deleted Files</h4>
                    {deleteOperations
                      .map((op) => {
                        if (!op || !op.operation_id) return null;
                        const fileName = getFileName(op.source_path);
                        const storageInfo = getStorageInfo(op.source_id);
                        return (
                          <div
                            key={op.operation_id}
                            className={`transfer-item transfer-item-completed transfer-item-compact ${op.status === 'Failed' ? 'failed' : ''}`}
                          >
                            <div className="transfer-item-header">
                              <div className="transfer-item-name-row">
                                <span
                                  className="transfer-item-name"
                                  title={fileName}
                                >
                                  {fileName}
                                </span>
                                <span
                                  className="transfer-item-storage-badge"
                                  title={`${storageInfo.name} (${formatProviderName(storageInfo.provider)})`}
                                >
                                  {formatProviderName(storageInfo.provider)}
                                </span>
                              </div>
                              {op.status === 'Completed' ? (
                                <span className="transfer-status-icon">✓</span>
                              ) : (
                                <span className="transfer-status-icon failed">
                                  ✕
                                </span>
                              )}
                            </div>
                            <div className="transfer-item-details">
                              <span>Delete</span>
                              {op.completed_at && (
                                <>
                                  <span className="transfer-separator">•</span>
                                  <span>
                                    {formatTimestamp(op.completed_at)}
                                  </span>
                                </>
                              )}
                            </div>
                            {op.error && (
                              <div className="transfer-error">{op.error}</div>
                            )}
                          </div>
                        );
                      })
                      .filter(Boolean)}
                  </div>
                )}

                {safeCompletedUploads.length === 0 &&
                  safeCompletedDownloads.length === 0 &&
                  deleteOperations.length === 0 && (
                    <div className="transfer-empty">
                      <p>No transfer history</p>
                    </div>
                  )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TransferPanel;
