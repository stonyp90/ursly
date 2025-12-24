/**
 * Storage Browser Page
 * Simple UI for browsing files across multiple storage sources
 * with on-demand warming and transcoding
 */
import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { StorageService } from '../services/storage.service';
import type {
  StorageSource,
  FileMetadata,
  WarmProgress,
  TranscodeProgress,
} from '../types/storage';
import { Breadcrumbs, type BreadcrumbItem } from '../components/Breadcrumbs';
import '../styles/storage-browser.css';

export function StorageBrowserPage() {
  const [sources, setSources] = useState<StorageSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<StorageSource | null>(
    null,
  );
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [warmProgress, setWarmProgress] = useState<
    Record<string, WarmProgress>
  >({});
  const [transcodeProgress, setTranscodeProgress] = useState<
    Record<string, TranscodeProgress>
  >({});
  const [showMountDialog, setShowMountDialog] = useState(false);

  useEffect(() => {
    loadSources();

    // Listen for warm progress events
    const unlistenWarm = listen<WarmProgress>('warm-progress', (event) => {
      setWarmProgress((prev) => ({
        ...prev,
        [event.payload.filePath]: event.payload,
      }));
    });

    // Listen for transcode progress events
    const unlistenTranscode = listen<TranscodeProgress>(
      'transcode-progress',
      (event) => {
        setTranscodeProgress((prev) => ({
          ...prev,
          [event.payload.filePath]: event.payload,
        }));
      },
    );

    return () => {
      unlistenWarm.then((fn) => fn());
      unlistenTranscode.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (selectedSource) {
      loadFiles(selectedSource.id, currentPath);
    }
  }, [selectedSource, currentPath]);

  const loadSources = async () => {
    try {
      const sourceList = await StorageService.listSources();
      setSources(sourceList);
      if (sourceList.length > 0 && !selectedSource) {
        setSelectedSource(sourceList[0]);
      }
    } catch (err) {
      console.error('Failed to load sources:', err);
    }
  };

  const loadFiles = async (sourceId: string, path: string) => {
    setLoading(true);
    try {
      const fileList = await StorageService.listFiles(sourceId, path);
      setFiles(fileList);
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setLoading(false);
    }
  };

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    if (!selectedSource) return [];

    const parts = currentPath.split('/').filter(Boolean);
    const crumbs: BreadcrumbItem[] = [{ name: selectedSource.name, path: '' }];

    let accumulated = '';
    for (const part of parts) {
      accumulated += '/' + part;
      crumbs.push({ name: part, path: accumulated });
    }

    return crumbs;
  };

  const handleWarmFile = async (file: FileMetadata) => {
    if (!selectedSource) return;

    try {
      await StorageService.warmFile({
        sourceId: selectedSource.id,
        filePath: file.path,
        priority: 'high',
      });
    } catch (err) {
      alert(`Failed to warm file: ${err}`);
    }
  };

  const handleTranscodeVideo = async (file: FileMetadata) => {
    if (!selectedSource) return;

    try {
      await StorageService.transcodeVideo({
        sourceId: selectedSource.id,
        filePath: file.path,
        format: 'hls',
        quality: 'high',
      });
    } catch (err) {
      alert(`Failed to transcode video: ${err}`);
    }
  };

  const handleFileClick = (file: FileMetadata) => {
    if (file.mimeType?.startsWith('video/')) {
      // Video file - offer transcode
      const proceed = confirm(`Transcode ${file.name} to HLS for streaming?`);
      if (proceed) {
        handleTranscodeVideo(file);
      }
    } else if (file.canWarm && !file.isWarmed) {
      // Cold file - offer warm
      const proceed = confirm(
        `This file is in cold storage. Warm to hot tier (FSxN SSD)?`,
      );
      if (proceed) {
        handleWarmFile(file);
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getTierBadge = (file: FileMetadata) => {
    if (file.isWarmed) {
      return <span className="badge hot">🔥 Hot (FSxN SSD)</span>;
    }
    switch (file.tierStatus) {
      case 'cold':
        return <span className="badge cold">❄️ Cold (S3)</span>;
      case 'warm':
        return <span className="badge warm">🌡️ Warm</span>;
      case 'archive':
        return <span className="badge archive">📦 Archive</span>;
      default:
        return <span className="badge">📁 {file.tierStatus}</span>;
    }
  };

  const getFileIcon = (file: FileMetadata) => {
    if (file.mimeType?.startsWith('video/')) return '🎬';
    if (file.mimeType?.startsWith('audio/')) return '🎵';
    if (file.mimeType?.startsWith('image/')) return '🖼️';
    return '📄';
  };

  return (
    <div className="page storage-browser">
      <header className="page-header">
        <h1>Storage Browser</h1>
        <p className="subtitle">
          Browse files across S3, FSx ONTAP, and block storage with on-demand
          warming
        </p>
      </header>

      <div className="browser-layout">
        {/* Storage Sources Sidebar */}
        <aside className="sources-sidebar">
          <div className="sidebar-header">
            <h3>Storage Sources</h3>
            <button
              onClick={() => setShowMountDialog(true)}
              className="btn-icon"
            >
              +
            </button>
          </div>

          <div className="source-list">
            {sources.map((source) => (
              <button
                key={source.id}
                className={`source-item ${selectedSource?.id === source.id ? 'active' : ''}`}
                onClick={() => setSelectedSource(source)}
              >
                <div className="source-icon">
                  {source.category === 'cloud' && '☁️'}
                  {source.category === 'hybrid' && '🗄️'}
                  {source.category === 'local' && '💾'}
                  {source.category === 'block' && '📦'}
                  {source.category === 'network' && '🖥️'}
                  {source.category === 'custom' && '🔌'}
                </div>
                <div className="source-info">
                  <div className="source-name">{source.name}</div>
                  <div className="source-type">
                    {source.providerId.toUpperCase()}
                  </div>
                </div>
                {source.status !== 'connected' && (
                  <span className="status-indicator offline">●</span>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* File Browser */}
        <main className="file-browser">
          {selectedSource && (
            <>
              <div className="browser-toolbar">
                <Breadcrumbs
                  items={getBreadcrumbs()}
                  onNavigate={(path) => {
                    setCurrentPath(path);
                    loadFiles(selectedSource.id, path);
                  }}
                  maxVisible={5}
                  showIcons={true}
                  rootIcon={
                    selectedSource.category === 'cloud'
                      ? '☁️'
                      : selectedSource.category === 'network'
                        ? '🖥️'
                        : selectedSource.category === 'hybrid'
                          ? '🗄️'
                          : '💻'
                  }
                />
                <button
                  className="btn-icon"
                  onClick={() => loadFiles(selectedSource.id, currentPath)}
                  title="Refresh"
                >
                  🔄
                </button>
              </div>

              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading files...</p>
                </div>
              ) : (
                <div className="file-grid">
                  {files.map((file) => {
                    const warm = warmProgress[file.path];
                    const transcode = transcodeProgress[file.path];

                    return (
                      <div
                        key={file.path}
                        className="file-card"
                        onClick={() => handleFileClick(file)}
                      >
                        <div className="file-icon">{getFileIcon(file)}</div>

                        <div className="file-info">
                          <div className="file-name" title={file.name}>
                            {file.name}
                          </div>
                          <div className="file-meta">
                            <span>{formatSize(file.size)}</span>
                            {getTierBadge(file)}
                          </div>
                        </div>

                        {/* Warming Progress */}
                        {warm && warm.status !== 'completed' && (
                          <div className="progress-overlay">
                            <div className="progress-bar">
                              <div
                                className="progress-fill warming"
                                style={{ width: `${warm.progress}%` }}
                              />
                            </div>
                            <div className="progress-text">
                              Warming: {warm.progress.toFixed(0)}%
                            </div>
                          </div>
                        )}

                        {/* Transcoding Progress */}
                        {transcode && transcode.status !== 'completed' && (
                          <div className="progress-overlay">
                            <div className="progress-bar">
                              <div
                                className="progress-fill transcoding"
                                style={{ width: `${transcode.progress}%` }}
                              />
                            </div>
                            <div className="progress-text">
                              Transcoding: {transcode.progress.toFixed(0)}%
                            </div>
                          </div>
                        )}

                        {/* Ready to Play */}
                        {transcode?.status === 'completed' &&
                          transcode.outputUrl && (
                            <div className="action-overlay">
                              <button
                                className="btn-play"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(transcode.outputUrl, '_blank');
                                }}
                              >
                                ▶️ Play HLS
                              </button>
                            </div>
                          )}

                        {/* Quick Actions */}
                        <div className="file-actions">
                          {file.canWarm && !file.isWarmed && (
                            <button
                              className="btn-action warm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWarmFile(file);
                              }}
                              title="Warm to hot tier"
                            >
                              🔥
                            </button>
                          )}
                          {file.canTranscode && (
                            <button
                              className="btn-action transcode"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTranscodeVideo(file);
                              }}
                              title="Transcode to HLS"
                            >
                              🎬
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {!selectedSource && (
            <div className="empty-state">
              <p>No storage source selected</p>
              <button onClick={() => setShowMountDialog(true)}>
                Mount Storage Source
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Mount Dialog (simplified - would be a proper modal) */}
      {showMountDialog && (
        <div
          className="modal-overlay"
          onClick={() => setShowMountDialog(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Mount Storage Source</h3>
            <p>Backend mount configuration goes here...</p>
            <button onClick={() => setShowMountDialog(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
