/**
 * ObjectStoragePanel Component
 *
 * Simplified UI for object storage (S3) operations:
 * - Upload files with progress tracking
 * - View current and past uploads
 * - Change storage tier (hot/nearline vs cold)
 * - Download files
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import './ObjectStoragePanel.css';

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

interface ObjectStoragePanelProps {
  sourceId: string;
  onRefresh?: () => void;
}

export const ObjectStoragePanel: React.FC<ObjectStoragePanelProps> = ({
  sourceId,
  onRefresh,
}) => {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const loadUploads = useCallback(async () => {
    try {
      const uploadList = await invoke<UploadState[]>('vfs_list_uploads');
      // Filter uploads for this source with defensive checks
      const sourceUploads = (uploadList || []).filter(
        (u) => u && u.source_id === sourceId,
      );
      setUploads(sourceUploads);
    } catch (err) {
      console.error('Failed to load uploads:', err);
      // Set empty array on error to prevent rendering issues
      setUploads([]);
    }
  }, [sourceId]);

  useEffect(() => {
    loadUploads();
    const interval = setInterval(loadUploads, 1000); // Update every second
    return () => clearInterval(interval);
  }, [loadUploads]);

  const handleUpload = async () => {
    try {
      setIsUploading(true);

      const { invoke } = await import('@tauri-apps/api/core');
      const { open } = await import('@tauri-apps/plugin-dialog');

      // Show folder dialog first (allows selecting folders)
      // On macOS, you can select folders in this dialog
      const folderResult = await open({
        multiple: true,
        directory: true,
        title: 'Select folders to upload (or Cancel to select files)',
      });

      // If folders were selected, process them
      let folders: string[] = [];
      const files: string[] = [];

      if (folderResult) {
        folders = Array.isArray(folderResult) ? folderResult : [folderResult];
      } else {
        // If no folders selected, show file dialog
        // Don't specify filters to allow ALL file types (no restrictions)
        const fileResult = await open({
          multiple: true,
          directory: false,
          // No filters specified = allow all file types
          title: 'Select files to upload',
        });

        if (!fileResult) {
          setIsUploading(false);
          return; // User canceled both dialogs
        }

        const selectedPaths = Array.isArray(fileResult)
          ? fileResult
          : [fileResult];

        // Check each selected path - some might be folders if user used Cmd+Click
        for (const path of selectedPaths) {
          try {
            const isDir = await invoke<boolean>('vfs_is_directory', {
              path: path,
            });
            if (isDir) {
              folders.push(path);
            } else {
              files.push(path);
            }
          } catch {
            // If check fails, assume it's a file
            files.push(path);
          }
        }
      }

      // Process folders
      for (const folderPath of folders) {
        try {
          const uploadIds = await invoke<string[]>('vfs_upload_folder', {
            sourceId,
            localFolderPath: folderPath,
            s3BasePath: '',
            partSize: null,
          });
          console.log(
            `Folder upload started: ${folderPath} (${uploadIds.length} files)`,
          );
        } catch (err) {
          console.error(`Failed to upload folder ${folderPath}:`, err);
          alert(`Failed to upload folder ${folderPath}: ${err}`);
        }
      }

      // Process files
      for (const filePath of files) {
        try {
          // Upload as single file
          const fileName =
            filePath.split('/').pop() ||
            filePath.split('\\').pop() ||
            'unknown';
          await invoke('vfs_start_multipart_upload', {
            sourceId,
            localPath: filePath,
            s3Path: fileName,
            partSize: null,
          });
          console.log(`File upload started: ${fileName}`);
        } catch (err) {
          console.error(`Failed to upload ${filePath}:`, err);
          alert(`Failed to upload ${filePath}: ${err}`);
        }
      }

      setIsUploading(false);
      loadUploads();
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setIsUploading(false);
      alert(`Upload failed: ${err}`);
    }
  };

  const handleChangeTier = async (path: string, targetTier: 'hot' | 'cold') => {
    try {
      await invoke('vfs_change_tier', {
        sourceId,
        paths: [path],
        targetTier: targetTier,
      });
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to change tier:', err);
    }
  };

  const handleDownload = async (path: string) => {
    try {
      const fileName = path.split('/').pop() || 'download';

      // Open save dialog
      const savePath = await save({
        defaultPath: fileName,
        filters: [
          {
            name: 'All Files',
            extensions: ['*'],
          },
        ],
      });

      if (!savePath) {
        return; // User cancelled
      }

      // Read file from S3 as binary
      const fileData = await invoke<number[]>('vfs_read_file_bytes', {
        sourceId,
        path,
      });

      // Download file using Rust command (handles file writing)
      await invoke('vfs_download_file', {
        sourceId,
        path,
        destinationPath: savePath,
      });

      console.log('File downloaded successfully:', savePath);
    } catch (err) {
      console.error('Download failed:', err);
      alert(`Download failed: ${err}`);
    }
  };

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

  const getProgressPercentage = (upload: UploadState): number => {
    if (!upload || upload.total_size === 0) return 0;
    const uploaded = upload.bytes_uploaded || 0;
    const total = upload.total_size || 0;
    if (total === 0) return 0;
    return Math.min(100, Math.round((uploaded / total) * 100));
  };

  const getFileName = (upload: UploadState): string => {
    if (!upload || !upload.key) return 'Unknown';
    return upload.key.split('/').pop() || 'Unknown';
  };

  // Memoize filtered uploads to prevent unnecessary re-renders
  const { activeUploads, completedUploads, failedUploads } = useMemo(() => {
    const uploadsList = uploads || [];

    const active = uploadsList.filter(
      (u) =>
        u &&
        (u.status === 'InProgress' ||
          u.status === 'Pending' ||
          u.status === 'Paused'),
    );

    const completed = uploadsList
      .filter((u) => u && u.status === 'Completed')
      .sort((a, b) => {
        const aTime = (a.completed_at || a.last_updated_at || '').toString();
        const bTime = (b.completed_at || b.last_updated_at || '').toString();
        return bTime.localeCompare(aTime);
      })
      .slice(0, showHistory ? 50 : 5);

    const failed = uploadsList.filter((u) => u && u.status === 'Failed');

    return {
      activeUploads: active,
      completedUploads: completed,
      failedUploads: failed,
    };
  }, [uploads, showHistory]);

  return (
    <div className="object-storage-panel">
      <div className="object-storage-header">
        <h3>Object Storage</h3>
        <button
          className="object-storage-upload-btn"
          onClick={handleUpload}
          disabled={isUploading}
          title="Upload files, folders, or a mix of both"
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>

      {/* Current Uploads */}
      {activeUploads.length > 0 && (
        <div className="object-storage-section">
          <h4>Uploading ({activeUploads.length})</h4>
          <div className="upload-list">
            {activeUploads
              .map((upload) => {
                if (!upload || !upload.upload_id) return null;
                const percentage = getProgressPercentage(upload);
                const fileName = getFileName(upload);
                const bytesUploaded = upload.bytes_uploaded || 0;
                const totalSize = upload.total_size || 0;
                return (
                  <div key={upload.upload_id} className="upload-item">
                    <div className="upload-item-header">
                      <span className="upload-item-name" title={fileName}>
                        {fileName}
                      </span>
                      <span className="upload-item-percentage">
                        {percentage}%
                      </span>
                    </div>
                    <div className="upload-progress-bar">
                      <div
                        className="upload-progress-fill"
                        style={{
                          width: `${Math.min(100, Math.max(0, percentage))}%`,
                        }}
                      />
                    </div>
                    <div className="upload-item-details">
                      <span>
                        {formatBytes(bytesUploaded)} / {formatBytes(totalSize)}
                      </span>
                      {upload.speed_bytes_per_sec && (
                        <>
                          <span className="upload-separator">•</span>
                          <span>
                            {formatBytes(upload.speed_bytes_per_sec)}/s
                          </span>
                        </>
                      )}
                      {upload.estimated_time_remaining_sec && (
                        <>
                          <span className="upload-separator">•</span>
                          <span>
                            {formatTime(upload.estimated_time_remaining_sec)}{' '}
                            left
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
              .filter(Boolean)}
          </div>
        </div>
      )}

      {/* Failed Uploads */}
      {failedUploads.length > 0 && (
        <div className="object-storage-section">
          <h4>Failed ({failedUploads.length})</h4>
          <div className="upload-list">
            {failedUploads
              .map((upload) => {
                if (!upload || !upload.upload_id) return null;
                const fileName = getFileName(upload);
                return (
                  <div
                    key={upload.upload_id}
                    className="upload-item upload-item-failed"
                  >
                    <div className="upload-item-header">
                      <span className="upload-item-name" title={fileName}>
                        {fileName}
                      </span>
                    </div>
                    {upload.error && (
                      <div className="upload-item-error">{upload.error}</div>
                    )}
                  </div>
                );
              })
              .filter(Boolean)}
          </div>
        </div>
      )}

      {/* Completed Uploads */}
      {completedUploads.length > 0 && (
        <div className="object-storage-section">
          <div className="object-storage-section-header">
            <h4>Recent Uploads ({completedUploads.length})</h4>
            {completedUploads.length > 5 && (
              <button
                className="object-storage-toggle-history"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    setShowHistory(!showHistory);
                  } catch (err) {
                    console.error('Error toggling history:', err);
                  }
                }}
              >
                {showHistory ? 'Show Less' : 'Show All'}
              </button>
            )}
          </div>
          <div className="upload-list">
            {completedUploads
              .map((upload) => {
                if (!upload || !upload.upload_id) return null;
                const fileName = getFileName(upload);
                const fileSize = upload.total_size || 0;
                return (
                  <div
                    key={upload.upload_id}
                    className="upload-item upload-item-completed"
                  >
                    <div className="upload-item-header">
                      <span className="upload-item-name" title={fileName}>
                        {fileName}
                      </span>
                      <span className="upload-item-size">
                        {formatBytes(fileSize)}
                      </span>
                    </div>
                    <div className="upload-item-actions">
                      <button
                        className="upload-action-btn"
                        onClick={() => upload.key && handleDownload(upload.key)}
                        title="Download"
                      >
                        Download
                      </button>
                      <button
                        className="upload-action-btn"
                        onClick={() =>
                          upload.key && handleChangeTier(upload.key, 'hot')
                        }
                        title="Move to Hot Tier (Standard storage)"
                      >
                        Hot
                      </button>
                      <button
                        className="upload-action-btn"
                        onClick={() =>
                          upload.key && handleChangeTier(upload.key, 'cold')
                        }
                        title="Move to Cold Tier (Instant retrieval, lower cost)"
                      >
                        Cold
                      </button>
                    </div>
                  </div>
                );
              })
              .filter(Boolean)}
          </div>
        </div>
      )}

      {activeUploads.length === 0 &&
        completedUploads.length === 0 &&
        failedUploads.length === 0 && (
          <div className="object-storage-empty">
            <p>No uploads yet</p>
            <button
              className="object-storage-upload-btn"
              onClick={handleUpload}
            >
              Upload Files or Folders
            </button>
          </div>
        )}
    </div>
  );
};

export default ObjectStoragePanel;
