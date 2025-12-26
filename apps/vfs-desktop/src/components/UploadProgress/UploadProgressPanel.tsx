/**
 * UploadProgressPanel Component
 *
 * Panel that displays all active uploads
 */
import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { UploadProgress } from './UploadProgress';
import './UploadProgressPanel.css';

interface UploadState {
  upload_id: string;
  source_id: string;
  key: string;
  local_path: string;
  total_size: number;
  status: string;
}

export const UploadProgressPanel: React.FC = () => {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [activeUploads, setActiveUploads] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load initial uploads
    loadUploads();

    // Poll for updates
    const interval = setInterval(loadUploads, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadUploads = async () => {
    try {
      const uploadList = await invoke<UploadState[]>('vfs_list_uploads');
      const active = uploadList
        .filter(
          (u) =>
            u.status === 'Pending' ||
            u.status === 'InProgress' ||
            u.status === 'Paused',
        )
        .map((u) => u.upload_id);

      setUploads(uploadList);
      setActiveUploads(new Set(active));
    } catch (err) {
      console.error('Failed to load uploads:', err);
    }
  };

  const handleUploadComplete = (uploadId: string) => {
    setActiveUploads((prev) => {
      const next = new Set(prev);
      next.delete(uploadId);
      return next;
    });
    // Reload after a delay to show completed state
    setTimeout(loadUploads, 1000);
  };

  const handleUploadCancel = async (uploadId: string) => {
    try {
      // Cancel is handled by UploadProgress component
      setActiveUploads((prev) => {
        const next = new Set(prev);
        next.delete(uploadId);
        return next;
      });
      loadUploads();
    } catch (err) {
      console.error('Failed to cancel upload:', err);
    }
  };

  const activeUploadList = uploads.filter((u) =>
    activeUploads.has(u.upload_id),
  );

  if (activeUploadList.length === 0) {
    return null;
  }

  return (
    <div className="upload-progress-panel">
      <div className="upload-progress-panel-header">
        <h3 className="upload-progress-panel-title">Uploads</h3>
        <span className="upload-progress-panel-count">
          {activeUploadList.length}
        </span>
      </div>
      <div className="upload-progress-panel-list">
        {activeUploadList.map((upload) => {
          const fileName = upload.key.split('/').pop() || upload.key;
          return (
            <UploadProgress
              key={upload.upload_id}
              uploadId={upload.upload_id}
              fileName={fileName}
              onComplete={() => handleUploadComplete(upload.upload_id)}
              onCancel={() => handleUploadCancel(upload.upload_id)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default UploadProgressPanel;
