/**
 * BrowserFinderPage - Browser-only Virtual File System Browser
 *
 * A version of the Finder that works without Tauri/native filesystem access.
 * Uses the BrowserApiService to communicate with the backend API for:
 * - Browsing file metadata from Elasticsearch
 * - Viewing thumbnails and previews
 * - Searching across all storage tiers
 * - Tagging files
 * - Downloading files (via presigned URLs)
 * - Requesting tier changes
 *
 * This component has LIMITED functionality compared to FinderPage:
 * - NO: Copy, Cut, Paste, Delete, Move, Rename, New Folder
 * - YES: Browse, Search, View, Preview, Download, Tag, Favorites
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getBrowserApi } from '../services/browser-api.service';
import type {
  StorageSource,
  FileMetadata,
  ApiFileListResponse,
  ApiSearchRequest,
  GlobalFavorite,
  FileTierStatus,
} from '../types/storage';
import { Breadcrumbs, type BreadcrumbItem } from '../components/Breadcrumbs';
import {
  IconStar,
  IconHome,
  IconFolder,
  IconCloud,
  IconNetwork,
  IconDatabase,
  IconTag,
  getFileIcon as getFileIconComponent,
} from '../components/CyberpunkIcons';
import { InfoModal } from '../components/InfoModal';
import {
  KeyboardShortcutHelper,
  useKeyboardShortcutHelper,
} from '../components/KeyboardShortcutHelper';
import '../styles/finder.css';

type ViewMode = 'icon' | 'list';

interface SearchState {
  query: string;
  filters: ApiSearchRequest['filters'];
  results: FileMetadata[];
  totalCount: number;
  isSearching: boolean;
}

export function BrowserFinderPage() {
  const api = getBrowserApi();

  // Core state
  const [sources, setSources] = useState<StorageSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<StorageSource | null>(
    null,
  );
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('icon');
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  // Search state
  const [search, setSearch] = useState<SearchState>({
    query: '',
    filters: {},
    results: [],
    totalCount: 0,
    isSearching: false,
  });

  // UI state
  const [favorites, setFavorites] = useState<GlobalFavorite[]>([]);
  const [allTags, setAllTags] = useState<
    { name: string; count: number; color?: string }[]
  >([]);
  const [infoModal, setInfoModal] = useState<{
    visible: boolean;
    file: FileMetadata | null;
  }>({
    visible: false,
    file: null,
  });

  // Keyboard shortcuts
  const shortcutHelper = useKeyboardShortcutHelper();

  // ============================================================================
  // Load Data
  // ============================================================================

  const loadSources = useCallback(async () => {
    try {
      const sourcesData = await api.listSources();
      setSources(sourcesData);

      // Auto-select first source
      if (sourcesData.length > 0 && !selectedSource) {
        setSelectedSource(sourcesData[0]);
      }
    } catch (err) {
      console.error('Failed to load sources:', err);
      setError('Failed to load storage sources');
    }
  }, [api, selectedSource]);

  const loadFiles = useCallback(
    async (sourceId: string, path: string) => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.listFiles(sourceId, path, {
          showHidden: showHiddenFiles,
        });
        setFiles(response.files);
      } catch (err) {
        console.error('Failed to load files:', err);
        setError('Failed to load files');
        setFiles([]);
      } finally {
        setLoading(false);
      }
    },
    [api, showHiddenFiles],
  );

  const loadFavorites = useCallback(async () => {
    try {
      const favs = await api.getFavorites();
      setFavorites(
        favs.map((f, i) => ({
          id: `${f.sourceId}:${f.path}`,
          name: f.name,
          path: f.path,
          sourceId: f.sourceId,
          sourceName: f.sourceId,
          isDirectory: true,
          addedAt: new Date().toISOString(),
          order: i,
        })),
      );
    } catch (err) {
      console.error('Failed to load favorites:', err);
    }
  }, [api]);

  const loadTags = useCallback(async () => {
    try {
      const tags = await api.listAllTags();
      setAllTags(tags);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  }, [api]);

  // Initialize
  useEffect(() => {
    loadSources();
    loadFavorites();
    loadTags();
  }, [loadSources, loadFavorites, loadTags]);

  // Load files when source or path changes
  useEffect(() => {
    if (selectedSource) {
      loadFiles(selectedSource.id, currentPath);
    }
  }, [selectedSource, currentPath, loadFiles]);

  // ============================================================================
  // Search
  // ============================================================================

  const handleSearch = useCallback(
    async (query: string) => {
      setSearch((prev) => ({ ...prev, query, isSearching: true }));

      if (!query.trim()) {
        setSearch((prev) => ({
          ...prev,
          results: [],
          totalCount: 0,
          isSearching: false,
        }));
        return;
      }

      try {
        const response = await api.search({
          query,
          filters: search.filters,
          includeAggregations: true,
          pageSize: 50,
        });

        setSearch((prev) => ({
          ...prev,
          results: response.files,
          totalCount: response.totalCount,
          isSearching: false,
        }));
      } catch (err) {
        console.error('Search failed:', err);
        setSearch((prev) => ({ ...prev, isSearching: false }));
      }
    },
    [api, search.filters],
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.query) {
        handleSearch(search.query);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search.query, handleSearch]);

  // ============================================================================
  // Navigation
  // ============================================================================

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSelectedFiles(new Set());
    setSearch((prev) => ({ ...prev, query: '', results: [], totalCount: 0 }));
  };

  const goUp = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/');
    navigateTo(parentPath);
  };

  const handleFileDoubleClick = (file: FileMetadata) => {
    const isFolder =
      file.mimeType === 'folder' || file.path.endsWith('/') || file.isDirectory;

    if (isFolder) {
      navigateTo(file.path);
    } else {
      // Preview the file
      handlePreview(file);
    }
  };

  const handleFileClick = (file: FileMetadata, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      // Toggle selection
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        if (next.has(file.path)) next.delete(file.path);
        else next.add(file.path);
        return next;
      });
    } else if (e.shiftKey && selectedFiles.size > 0) {
      // Range select
      const allPaths = files.map((f) => f.path);
      const lastSelected = Array.from(selectedFiles).pop()!;
      const lastIdx = allPaths.indexOf(lastSelected);
      const currentIdx = allPaths.indexOf(file.path);
      const [start, end] = [
        Math.min(lastIdx, currentIdx),
        Math.max(lastIdx, currentIdx),
      ];
      setSelectedFiles(new Set(allPaths.slice(start, end + 1)));
    } else {
      setSelectedFiles(new Set([file.path]));
    }
  };

  // ============================================================================
  // File Actions (Limited in Browser Mode)
  // ============================================================================

  const handlePreview = async (file: FileMetadata) => {
    // For images, show preview
    if (file.mimeType?.startsWith('image/')) {
      const previewUrl = api.getPreviewUrl(selectedSource!.id, file.path);
      window.open(previewUrl, '_blank');
      return;
    }

    // For videos, get stream info
    if (file.mimeType?.startsWith('video/')) {
      try {
        const streamInfo = await api.getStreamInfo(
          selectedSource!.id,
          file.path,
        );
        // Open HLS player (could be a modal)
        window.open(streamInfo.manifestUrl, '_blank');
      } catch (err) {
        console.error('Failed to get stream info:', err);
      }
      return;
    }

    // For other files, show info modal
    setInfoModal({ visible: true, file });
  };

  const handleDownload = async (file: FileMetadata) => {
    try {
      const downloadUrl = await api.getDownloadUrl(
        selectedSource!.id,
        file.path,
      );
      window.open(downloadUrl, '_blank');
    } catch (err) {
      console.error('Failed to get download URL:', err);
      alert('Failed to initiate download');
    }
  };

  const handleAddTag = async (file: FileMetadata, tag: string) => {
    try {
      await api.addTags(selectedSource!.id, [file.path], [tag]);
      // Refresh tags
      loadTags();
      // Update local file state
      setFiles((prev) =>
        prev.map((f) =>
          f.path === file.path ? { ...f, tags: [...(f.tags || []), tag] } : f,
        ),
      );
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
  };

  const handleRemoveTag = async (file: FileMetadata, tag: string) => {
    try {
      await api.removeTags(selectedSource!.id, [file.path], [tag]);
      // Update local file state
      setFiles((prev) =>
        prev.map((f) =>
          f.path === file.path
            ? { ...f, tags: (f.tags || []).filter((t) => t !== tag) }
            : f,
        ),
      );
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  const handleToggleFavorite = async (path: string) => {
    const isFav = favorites.some(
      (f) => f.sourceId === selectedSource?.id && f.path === path,
    );

    try {
      if (isFav) {
        await api.removeFavorite(selectedSource!.id, path);
      } else {
        const name = path.split('/').pop() || path;
        await api.addFavorite(selectedSource!.id, path, name);
      }
      loadFavorites();
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleRequestTierChange = async (
    file: FileMetadata,
    targetTier: FileTierStatus,
  ) => {
    try {
      const result = await api.requestTierChange(
        selectedSource!.id,
        [file.path],
        targetTier,
      );
      alert(`Tier change requested. Request ID: ${result.requestId}`);
    } catch (err) {
      console.error('Failed to request tier change:', err);
      alert('Failed to request tier change');
    }
  };

  const handleRequestRetrieval = async (file: FileMetadata) => {
    try {
      const result = await api.requestRetrieval(
        selectedSource!.id,
        [file.path],
        'standard',
      );
      alert(
        `Retrieval requested. Estimated time: ${result.estimatedMinutes} minutes`,
      );
    } catch (err) {
      console.error('Failed to request retrieval:', err);
      alert('Failed to request file retrieval');
    }
  };

  // ============================================================================
  // Breadcrumbs
  // ============================================================================

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    if (!selectedSource) return [];

    const items: BreadcrumbItem[] = [
      {
        name: selectedSource.name,
        path: '',
        icon: <IconCloud size={16} className="cyber-icon" />,
      },
    ];

    if (currentPath) {
      const parts = currentPath.split('/').filter(Boolean);
      let accPath = '';

      for (const part of parts) {
        accPath += `/${part}`;
        items.push({
          name: part,
          path: accPath,
          icon: <IconFolder size={16} className="cyber-icon" />,
        });
      }
    }

    return items;
  };

  // ============================================================================
  // Helpers
  // ============================================================================

  const getSelectedFile = (): FileMetadata | null => {
    if (selectedFiles.size !== 1) return null;
    const path = Array.from(selectedFiles)[0];
    return files.find((f) => f.path === path) || null;
  };

  const isFavorite = (path: string): boolean => {
    return favorites.some(
      (f) => f.sourceId === selectedSource?.id && f.path === path,
    );
  };

  const getFileIcon = (file: FileMetadata) => {
    if (file.mimeType === 'folder' || file.isDirectory) {
      return <IconFolder className="cyber-icon folder-icon" />;
    }

    // Check for thumbnail
    if (
      file.thumbnail ||
      (selectedSource &&
        (file.mimeType?.startsWith('image/') ||
          file.mimeType?.startsWith('video/')))
    ) {
      const thumbUrl =
        file.thumbnail ||
        api.getThumbnailUrl(selectedSource!.id, file.path, 128);
      return (
        <img
          src={thumbUrl}
          alt={file.name}
          className="file-thumbnail"
          loading="lazy"
          onError={(e) => {
            // Fallback to icon on error
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      );
    }

    const IconComponent = getFileIconComponent(
      file.mimeType || 'application/octet-stream',
    );
    return <IconComponent className="cyber-icon file-icon" />;
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // ============================================================================
  // Render
  // ============================================================================

  const displayFiles =
    search.query && search.results.length > 0 ? search.results : files;

  const selectedFile = getSelectedFile();

  return (
    <div className="finder browser-mode">
      {/* Toolbar */}
      <div className="finder-toolbar">
        <div className="toolbar-left">
          <button
            className="toolbar-btn"
            onClick={goUp}
            disabled={!currentPath}
            title="Go Up"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3.5L3 8.5h3v5h4v-5h3L8 3.5z" />
            </svg>
          </button>

          <Breadcrumbs items={getBreadcrumbs()} onNavigate={navigateTo} />
        </div>

        <div className="toolbar-right">
          <div className="view-switcher">
            <button
              className={`view-btn ${viewMode === 'icon' ? 'active' : ''}`}
              onClick={() => setViewMode('icon')}
              title="Icon View"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <rect x="1" y="2" width="14" height="2" rx="0.5" />
                <rect x="1" y="7" width="14" height="2" rx="0.5" />
                <rect x="1" y="12" width="14" height="2" rx="0.5" />
              </svg>
            </button>
          </div>

          <div className="search-box">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="search-icon"
            >
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search metadata..."
              value={search.query}
              onChange={(e) =>
                setSearch((prev) => ({ ...prev, query: e.target.value }))
              }
            />
            {search.isSearching && <span className="search-spinner" />}
          </div>

          <button
            className={`toolbar-btn ${showInfoPanel ? 'active' : ''}`}
            onClick={() => setShowInfoPanel(!showInfoPanel)}
            title="Toggle Info Panel"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 5a1 1 0 112 0 1 1 0 01-2 0zm1 3a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 8z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="finder-body">
        {/* Sidebar */}
        <aside className="finder-sidebar">
          {/* Favorites */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <IconStar className="section-icon" />
              <span>Favorites</span>
            </div>
            {favorites.length === 0 ? (
              <div className="sidebar-empty">
                <span className="empty-text">No favorites yet</span>
              </div>
            ) : (
              favorites.map((fav) => (
                <div
                  key={fav.id}
                  className={`sidebar-item ${selectedSource?.id === fav.sourceId && currentPath === fav.path ? 'active' : ''}`}
                  onClick={() => {
                    const source = sources.find((s) => s.id === fav.sourceId);
                    if (source) {
                      setSelectedSource(source);
                      navigateTo(fav.path);
                    }
                  }}
                >
                  <IconFolder className="sidebar-icon" />
                  <span className="sidebar-label">{fav.name}</span>
                </div>
              ))
            )}
          </div>

          {/* Storage Sources */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <IconDatabase className="section-icon" />
              <span>Storage</span>
            </div>
            {sources.map((source) => (
              <div
                key={source.id}
                className={`sidebar-item ${selectedSource?.id === source.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedSource(source);
                  navigateTo('');
                }}
              >
                <IconCloud className="sidebar-icon" />
                <span className="sidebar-label">{source.name}</span>
                {source.tierStatus && (
                  <span className={`tier-badge ${source.tierStatus}`}>
                    {source.tierStatus}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Tags */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <IconTag className="section-icon" />
              <span>Tags</span>
            </div>
            {allTags.length === 0 ? (
              <div className="sidebar-empty">
                <span className="empty-text">No tags yet</span>
              </div>
            ) : (
              allTags.slice(0, 10).map((tag) => (
                <div
                  key={tag.name}
                  className="sidebar-item"
                  onClick={() => {
                    setSearch((prev) => ({
                      ...prev,
                      query: `tag:${tag.name}`,
                      filters: { ...prev.filters, tags: [tag.name] },
                    }));
                  }}
                >
                  <span
                    className="tag-dot"
                    style={{
                      backgroundColor: tag.color || 'var(--finder-accent)',
                    }}
                  />
                  <span className="sidebar-label">{tag.name}</span>
                  <span className="sidebar-count">{tag.count}</span>
                </div>
              ))
            )}
          </div>

          {/* Browser Mode Notice */}
          <div className="sidebar-section browser-mode-notice">
            <div className="notice-content">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="notice-icon"
              >
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 5a1 1 0 112 0 1 1 0 01-2 0zm1 3a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 8z" />
              </svg>
              <span>Browser Mode</span>
            </div>
            <p className="notice-text">
              Limited to view, search, tag, and download. Install the desktop
              app for full file management.
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="finder-content">
          {loading && (
            <div className="finder-loading">
              <div className="loading-spinner" />
              <span>Loading...</span>
            </div>
          )}

          {error && (
            <div className="finder-error">
              <span>{error}</span>
              <button
                onClick={() =>
                  selectedSource && loadFiles(selectedSource.id, currentPath)
                }
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && displayFiles.length === 0 && (
            <div className="finder-empty">
              <IconFolder className="empty-icon" />
              <span>
                {search.query ? 'No results found' : 'This folder is empty'}
              </span>
            </div>
          )}

          {!loading &&
            !error &&
            displayFiles.length > 0 &&
            (viewMode === 'icon' ? (
              <div className="icon-view">
                {displayFiles.map((file) => (
                  <div
                    key={file.path}
                    className={`file-item ${selectedFiles.has(file.path) ? 'selected' : ''} ${
                      file.tierStatus === 'cold' ||
                      file.tierStatus === 'archive'
                        ? 'cold-file'
                        : ''
                    }`}
                    onClick={(e) => handleFileClick(file, e)}
                    onDoubleClick={() => handleFileDoubleClick(file)}
                  >
                    <div className="icon-placeholder">{getFileIcon(file)}</div>
                    <span className="file-name">{file.name}</span>
                    {file.tierStatus && file.tierStatus !== 'hot' && (
                      <span className={`tier-indicator ${file.tierStatus}`}>
                        {file.tierStatus}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="list-view">
                <div className="list-header">
                  <span className="col-name">Name</span>
                  <span className="col-size">Size</span>
                  <span className="col-modified">Modified</span>
                  <span className="col-tier">Tier</span>
                </div>
                {displayFiles.map((file) => (
                  <div
                    key={file.path}
                    className={`list-item ${selectedFiles.has(file.path) ? 'selected' : ''}`}
                    onClick={(e) => handleFileClick(file, e)}
                    onDoubleClick={() => handleFileDoubleClick(file)}
                  >
                    <span className="col-name">
                      <span className="file-icon">{getFileIcon(file)}</span>
                      {file.name}
                    </span>
                    <span className="col-size">
                      {file.mimeType === 'folder'
                        ? '--'
                        : formatSize(file.size)}
                    </span>
                    <span className="col-modified">
                      {formatDate(file.lastModified)}
                    </span>
                    <span className="col-tier">
                      {file.tierStatus && (
                        <span className={`tier-badge ${file.tierStatus}`}>
                          {file.tierStatus}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))}

          {/* Search Results Info */}
          {search.query && search.totalCount > 0 && (
            <div className="search-results-info">
              Showing {search.results.length} of {search.totalCount} results
            </div>
          )}
        </main>

        {/* Info Panel */}
        {showInfoPanel && selectedFile && (
          <aside className="finder-info">
            <div className="info-preview">{getFileIcon(selectedFile)}</div>
            <h3 className="info-name">{selectedFile.name}</h3>
            <span className="info-type">{selectedFile.mimeType}</span>

            <div className="info-meta">
              <div className="meta-section">
                <h4 className="meta-section-title">Details</h4>
                <div className="meta-row">
                  <span className="meta-label">Size</span>
                  <span className="meta-value">
                    {formatSize(selectedFile.size)}
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Modified</span>
                  <span className="meta-value">
                    {formatDate(selectedFile.lastModified)}
                  </span>
                </div>
                {selectedFile.tierStatus && (
                  <div className="meta-row">
                    <span className="meta-label">Tier</span>
                    <span
                      className={`meta-value tier-badge ${selectedFile.tierStatus}`}
                    >
                      {selectedFile.tierStatus}
                    </span>
                  </div>
                )}
              </div>

              {selectedFile.tags && selectedFile.tags.length > 0 && (
                <div className="meta-section">
                  <h4 className="meta-section-title">Tags</h4>
                  <div className="meta-tags">
                    {selectedFile.tags.map((tag) => (
                      <span
                        key={tag}
                        className="meta-tag"
                        onClick={() => handleRemoveTag(selectedFile, tag)}
                        title="Click to remove"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="info-actions">
              <button
                className="action-btn primary"
                onClick={() => handlePreview(selectedFile)}
              >
                Preview
              </button>
              <button
                className="action-btn"
                onClick={() => handleDownload(selectedFile)}
              >
                Download
              </button>
              <button
                className="action-btn"
                onClick={() => handleToggleFavorite(selectedFile.path)}
              >
                {isFavorite(selectedFile.path)
                  ? 'Remove Favorite'
                  : 'Add Favorite'}
              </button>
              {(selectedFile.tierStatus === 'cold' ||
                selectedFile.tierStatus === 'archive') && (
                <button
                  className="action-btn warm"
                  onClick={() => handleRequestRetrieval(selectedFile)}
                >
                  Request Retrieval
                </button>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Status Bar */}
      <div className="finder-statusbar">
        <span>{displayFiles.length} items</span>
        <span className="statusbar-mode">Browser Mode (Metadata Only)</span>
        {selectedFiles.size > 0 && <span>{selectedFiles.size} selected</span>}
      </div>

      {/* Info Modal */}
      {infoModal.visible && infoModal.file && (
        <InfoModal
          file={infoModal.file}
          onClose={() => setInfoModal({ visible: false, file: null })}
          onToggleFavorite={(file) => handleToggleFavorite(file.path)}
          isFavorite={isFavorite(infoModal.file.path)}
          onAddTag={(file, tag) => handleAddTag(file, tag)}
          onRemoveTag={(file, tag) => handleRemoveTag(file, tag)}
        />
      )}

      {/* Keyboard Shortcut Helper */}
      <KeyboardShortcutHelper
        isOpen={shortcutHelper.isOpen}
        onClose={shortcutHelper.close}
      />

      {/* Shortcut Hint Button */}
      <button
        className="shortcut-hint-button"
        onClick={shortcutHelper.toggle}
        title="Keyboard Shortcuts"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
          <line x1="6" y1="8" x2="6.01" y2="8" />
          <line x1="10" y1="8" x2="10.01" y2="8" />
          <line x1="14" y1="8" x2="14.01" y2="8" />
          <line x1="18" y1="8" x2="18.01" y2="8" />
          <line x1="8" y1="12" x2="8.01" y2="12" />
          <line x1="12" y1="12" x2="12.01" y2="12" />
          <line x1="16" y1="12" x2="16.01" y2="12" />
          <line x1="7" y1="16" x2="17" y2="16" />
        </svg>
      </button>
    </div>
  );
}

export default BrowserFinderPage;
