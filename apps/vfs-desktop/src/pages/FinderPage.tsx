/**
 * macOS Finder-inspired Virtual File System Browser
 * Supports multiple view modes and hybrid storage backends
 */
import React, { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { StorageService, VfsService } from '../services/storage.service';
import { DialogService } from '../services/dialog.service';
import type {
  StorageSource,
  FileMetadata,
  WarmProgress,
  GlobalFavorite,
} from '../types/storage';
import { Breadcrumbs, type BreadcrumbItem } from '../components/Breadcrumbs';
import {
  IconStar,
  IconHome,
  IconDesktop,
  IconDocuments,
  IconDownloads,
  IconPictures,
  IconMusic,
  IconVolumes,
  IconCloud,
  IconNetwork,
  IconDatabase,
  IconTag,
  IconFolder,
  getFileIcon as getFileIconComponent,
} from '../components/CyberpunkIcons';
import { InfoModal } from '../components/InfoModal';
import { AddStorageModal } from '../components/AddStorageModal';
import {
  KeyboardShortcutHelper,
  useKeyboardShortcutHelper,
} from '../components/KeyboardShortcutHelper';
import { useToast } from '../components/Toast';
import { ShortcutSettings } from '../components/ShortcutSettings';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { SearchBox } from '../components/SearchBox';
import { SpotlightSearch } from '../components/SpotlightSearch';
import { MetricsPreview } from '../components/MetricsPreview';
import { truncateMiddle } from '../utils/file-utils';
import '../styles/finder.css';

type ViewMode = 'icon' | 'list';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetFile?: FileMetadata;
}

interface FinderPageProps {
  onOpenMetrics?: () => void;
  onOpenSearch?: () => void;
  isSearchOpen?: boolean;
  onCloseSearch?: () => void;
}

export function FinderPage({
  onOpenMetrics,
  onOpenSearch: _onOpenSearch,
  isSearchOpen: externalSearchOpen,
  onCloseSearch: externalCloseSearch,
}: FinderPageProps) {
  const [sources, setSources] = useState<StorageSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<StorageSource | null>(
    null,
  );
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showAddStorage, setShowAddStorage] = useState(false);
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  const [warmProgress, setWarmProgress] = useState<
    Record<string, WarmProgress>
  >({});
  const [searchQuery, setSearchQuery] = useState('');
  const [fileOperation, setFileOperation] = useState<{
    type: string;
    inProgress: boolean;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
  });
  const [clipboardHasFiles, setClipboardHasFiles] = useState(false);
  const [nativeClipboardCount, setNativeClipboardCount] = useState(0);
  const [favorites, setFavorites] = useState<GlobalFavorite[]>([]);
  const [allTags, setAllTags] = useState<{ name: string; color?: string }[]>(
    [],
  );
  const [filterByTag, setFilterByTag] = useState<string | null>(null);
  // Sidebar section reordering - prepared for future implementation
  // const [sidebarSectionOrder, setSidebarSectionOrder] = useState<string[]>([
  //   'favorites',
  //   'storage',
  //   'tags',
  // ]);

  // Handle sidebar section reordering - prepared for future implementation
  // const handleSectionReorder = useCallback(
  //   (fromIndex: number, toIndex: number) => {
  //     setSidebarSectionOrder((prev) => {
  //       const newOrder = [...prev];
  //       const [removed] = newOrder.splice(fromIndex, 1);
  //       newOrder.splice(toIndex, 0, removed);
  //       // Persist to localStorage
  //       try {
  //         localStorage.setItem(
  //           'ursly-sidebar-section-order',
  //           JSON.stringify(newOrder),
  //         );
  //       } catch {
  //         // Ignore localStorage errors
  //       }
  //       return newOrder;
  //     });
  //   },
  //   [],
  // );

  // Load sidebar section order from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ursly-sidebar-section-order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSidebarSectionOrder(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Info modal state
  const [infoModal, setInfoModal] = useState<{
    visible: boolean;
    file: FileMetadata | null;
  }>({
    visible: false,
    file: null,
  });

  // Spotlight search state - use external control if provided, otherwise internal
  const [internalSpotlightOpen, setInternalSpotlightOpen] = useState(false);
  const spotlightOpen =
    externalSearchOpen !== undefined
      ? externalSearchOpen
      : internalSpotlightOpen;
  const handleCloseSpotlight =
    externalCloseSearch || (() => setInternalSpotlightOpen(false));

  // Navigation history
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Storage context menu state
  const [storageContextMenu, setStorageContextMenu] = useState<{
    source: StorageSource;
    x: number;
    y: number;
  } | null>(null);

  // Inline renaming state
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop state
  const [draggedFiles, setDraggedFiles] = useState<string[]>([]);
  const [draggedFileObjects, setDraggedFileObjects] = useState<FileMetadata[]>(
    [],
  );
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);

  // Keyboard shortcut helper
  const shortcutHelper = useKeyboardShortcutHelper();

  // Toast notifications for action feedback
  const toast = useToast();

  // Configurable keyboard shortcuts
  const shortcuts = useKeyboardShortcuts();
  const [showShortcutSettings, setShowShortcutSettings] = useState(false);

  // Collapsed storage groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  // Initialize
  useEffect(() => {
    initAndLoadSources();

    const unlisten = listen<WarmProgress>('warm-progress', (event) => {
      setWarmProgress((prev) => ({
        ...prev,
        [event.payload.filePath]: event.payload,
      }));
    });

    // Keyboard shortcuts
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Escape - cancel rename, clear cut state, deselect, or close modals
      if (e.key === 'Escape') {
        e.preventDefault();
        if (renamingFile) {
          cancelRename();
          return;
        }
        setSelectedFiles(new Set());
        setContextMenu({ visible: false, x: 0, y: 0, targetFile: undefined });
        return;
      }

      // Navigation shortcuts (work even without source)
      if (isMeta && e.key === '[') {
        e.preventDefault();
        goBack();
        return;
      } else if (isMeta && e.key === ']') {
        e.preventDefault();
        goForward();
        return;
      } else if (isMeta && e.key === 'ArrowUp') {
        e.preventDefault();
        goUp();
        return;
      }

      if (!selectedSource) return;

      // Select All - Cmd/Ctrl+A
      if (shortcuts.matchesShortcut(e, 'select-all')) {
        e.preventDefault();
        setSelectedFiles(new Set(files.map((f) => f.path)));
        toast.showActionToast(
          `Selected ${files.length} items`,
          shortcuts.formatShortcut('select-all'),
        );
        return;
      }

      // New Folder - Cmd/Ctrl+Shift+N
      if (shortcuts.matchesShortcut(e, 'new-folder')) {
        e.preventDefault();
        toast.showActionToast(
          'New Folder',
          shortcuts.formatShortcut('new-folder'),
        );
        handleNewFolder();
        return;
      }

      // Asset Details - Cmd/Ctrl+I
      if (
        shortcuts.matchesShortcut(e, 'get-info') &&
        selectedFiles.size === 1
      ) {
        e.preventDefault();
        const selectedPath = Array.from(selectedFiles)[0];
        const selectedFile = files.find((f) => f.path === selectedPath);
        if (selectedFile) {
          toast.showActionToast(
            'Asset Details',
            shortcuts.formatShortcut('get-info'),
          );
          setInfoModal({ visible: true, file: selectedFile });
        }
        return;
      }

      // Rename - F2 (Windows) or Enter when already selected (we'll use F2 for all OS)
      if (e.key === 'F2' && selectedFiles.size === 1) {
        e.preventDefault();
        const selectedPath = Array.from(selectedFiles)[0];
        const selectedFile = files.find((f) => f.path === selectedPath);
        if (selectedFile) {
          handleRename(selectedFile);
        }
        return;
      }

      // Quick Look / Preview - Space
      if (e.key === ' ' && selectedFiles.size === 1) {
        e.preventDefault();
        const selectedPath = Array.from(selectedFiles)[0];
        const selectedFile = files.find((f) => f.path === selectedPath);
        if (selectedFile) {
          setInfoModal({ visible: true, file: selectedFile });
        }
        return;
      }

      // Refresh - Cmd/Ctrl+R or F5
      if ((isMeta && e.key === 'r') || e.key === 'F5') {
        e.preventDefault();
        if (selectedSource) {
          toast.showActionToast('Refreshing...', isMeta ? '⌘R' : 'F5');
          loadFilesList(selectedSource.id, currentPath);
        }
        return;
      }

      // Duplicate - Cmd/Ctrl+D
      if (
        shortcuts.matchesShortcut(e, 'duplicate') &&
        selectedFiles.size === 1
      ) {
        e.preventDefault();
        const selectedPath = Array.from(selectedFiles)[0];
        const selectedFile = files.find((f) => f.path === selectedPath);
        if (selectedFile) {
          toast.showActionToast(
            'Duplicating...',
            shortcuts.formatShortcut('duplicate'),
          );
          handleDuplicate(selectedFile);
        }
        return;
      }

      // File operation shortcuts
      if (shortcuts.matchesShortcut(e, 'copy') && selectedFiles.size > 0) {
        e.preventDefault();
        toast.showActionToast(
          `Copied ${selectedFiles.size} item(s)`,
          shortcuts.formatShortcut('copy'),
        );
        await handleCopy();
      } else if (shortcuts.matchesShortcut(e, 'paste')) {
        e.preventDefault();
        toast.showActionToast('Paste', shortcuts.formatShortcut('paste'));
        await handlePaste();
      } else if (
        shortcuts.matchesShortcut(e, 'delete') &&
        selectedFiles.size > 0
      ) {
        e.preventDefault();
        await handleDelete();
      } else if (
        shortcuts.matchesShortcut(e, 'open') &&
        selectedFiles.size === 1
      ) {
        // Enter to open folder or file
        e.preventDefault();
        const selectedPath = Array.from(selectedFiles)[0];
        const selectedFile = files.find((f) => f.path === selectedPath);
        if (selectedFile) {
          handleFileDoubleClick(selectedFile);
        }
      }

      // Spotlight Search - Cmd/Ctrl+K
      if (shortcuts.matchesShortcut(e, 'spotlight')) {
        e.preventDefault();
        e.stopPropagation();
        if (_onOpenSearch) {
          // Use external handler if provided
          _onOpenSearch();
        } else {
          // Use internal state if no external control
          setInternalSpotlightOpen(true);
        }
        return; // Exit early to prevent other handlers
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unlisten.then((fn) => fn());
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedSource, selectedFiles, currentPath, files, renamingFile]);

  // Refresh clipboard state when window gains focus (detect native clipboard changes)
  useEffect(() => {
    const handleFocus = () => {
      refreshClipboardState();
    };

    window.addEventListener('focus', handleFocus);

    // Initial clipboard check
    refreshClipboardState();

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Handle spotlight quick actions
  useEffect(() => {
    const handleSpotlightAction = (e: CustomEvent<string>) => {
      const actionId = e.detail;
      switch (actionId) {
        case 'new-folder':
          handleNewFolder();
          break;
        case 'toggle-hidden':
          setShowHiddenFiles((prev) => !prev);
          break;
        case 'icon-view':
          setViewMode('icon');
          break;
        case 'list-view':
          setViewMode('list');
          break;
        case 'refresh':
          if (selectedSource) {
            loadFilesList(selectedSource.id, currentPath);
          }
          break;
      }
    };

    window.addEventListener(
      'spotlight-action',
      handleSpotlightAction as EventListener,
    );

    return () => {
      window.removeEventListener(
        'spotlight-action',
        handleSpotlightAction as EventListener,
      );
    };
  }, [selectedSource, currentPath]);

  const initAndLoadSources = async () => {
    try {
      // Initialize VFS first
      await StorageService.init();
      await loadSourcesList();

      // Load OS preferences for hidden files, etc.
      try {
        const osPrefs = await VfsService.getOsPreferences();
        setShowHiddenFiles(osPrefs.show_hidden_files);
      } catch (prefsErr) {
        // Ignore - use defaults if OS preferences not available
        console.debug('Could not load OS preferences:', prefsErr);
      }
    } catch (err) {
      console.error('Failed to initialize VFS:', err);
    }
  };

  // Load files when path changes (source changes are handled by selectSource)
  // This useEffect handles navigation within a source (folder changes)
  const prevSourceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedSource?.id) {
      // Only load if path changed within the same source
      // Source changes are handled directly by selectSource to avoid race conditions
      if (prevSourceIdRef.current === selectedSource.id) {
        loadFilesList(selectedSource.id, currentPath);
      }
      prevSourceIdRef.current = selectedSource.id;
    }
  }, [selectedSource?.id, currentPath]);

  // Load thumbnails when switching to grid view
  useEffect(() => {
    if (viewMode === 'icon' && selectedSource?.id && files.length > 0) {
      // Check if any files need thumbnails
      const needsThumbnails = files.some(
        (f) => !f.isDirectory && !f.thumbnail && canHaveThumbnail(f.name),
      );
      if (needsThumbnails) {
        loadThumbnailsForFiles(selectedSource.id, files);
      }
    }
  }, [viewMode]);

  // Helper to check if file can have a thumbnail
  const canHaveThumbnail = (filename: string): boolean => {
    const thumbnailTypes = [
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp',
      'heic',
      'pdf',
      'mp4',
      'mov',
      'avi',
      'mkv',
      'webm',
    ];
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return thumbnailTypes.includes(ext);
  };

  const loadSourcesList = async () => {
    try {
      const list = await StorageService.listSources();
      setSources(list);
      // Only auto-select first source if nothing is selected
      if (list.length > 0 && !selectedSource) {
        const firstSource = list[0];
        setSelectedSource(firstSource);
        // Explicitly load files for initial source
        // (since useEffect won't trigger - prevSourceIdRef is null initially)
        prevSourceIdRef.current = firstSource.id;
        await loadFilesList(firstSource.id, '');
      }
    } catch (err) {
      console.error('Failed to load sources:', err);
    }
  };

  const loadFilesList = async (sourceId: string, path: string) => {
    console.log('[VFS] Loading files:', sourceId, path);
    setLoading(true);
    try {
      const list = await StorageService.listFiles(sourceId, path);
      console.log('[VFS] Loaded', list.length, 'files');
      setFiles(list);

      // Load thumbnails for image/video files in the background
      if (viewMode === 'icon') {
        loadThumbnailsForFiles(sourceId, list);
      }
    } catch (err) {
      console.error('[VFS] Failed to load files:', err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  // Load thumbnails for files that support them
  const loadThumbnailsForFiles = async (
    sourceId: string,
    fileList: FileMetadata[],
  ) => {
    const thumbnailTypes = [
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp',
      'heic',
      'pdf',
      'mp4',
      'mov',
      'avi',
      'mkv',
      'webm',
    ];

    // Filter files that can have thumbnails
    const filesToLoad = fileList.filter((f) => {
      if (f.isDirectory || f.thumbnail) return false;
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return thumbnailTypes.includes(ext);
    });

    // Load thumbnails in batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < filesToLoad.length; i += batchSize) {
      const batch = filesToLoad.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (file) => {
          try {
            const thumbnail = await StorageService.getThumbnail(
              sourceId,
              file.path,
              128,
            );
            if (thumbnail) {
              // Update the file with thumbnail
              setFiles((prev) =>
                prev.map((f) =>
                  f.path === file.path ? { ...f, thumbnail } : f,
                ),
              );
            }
          } catch (error) {
            // Silently ignore thumbnail errors
            console.debug('Thumbnail load failed for:', file.name);
          }
        }),
      );
    }
  };

  // Load global favorites from localStorage
  const loadGlobalFavorites = () => {
    try {
      const stored = localStorage.getItem('ursly-global-favorites');
      if (stored) {
        const parsed = JSON.parse(stored) as GlobalFavorite[];
        setFavorites(parsed);
      }
    } catch (err) {
      console.error('Failed to load global favorites:', err);
      setFavorites([]);
    }
  };

  // Save global favorites to localStorage
  const saveGlobalFavorites = (favs: GlobalFavorite[]) => {
    try {
      localStorage.setItem('ursly-global-favorites', JSON.stringify(favs));
    } catch (err) {
      console.error('Failed to save global favorites:', err);
    }
  };

  // Add a file/folder to global favorites
  const addToGlobalFavorites = (file: FileMetadata, source: StorageSource) => {
    const newFavorite: GlobalFavorite = {
      id: `${source.id}:${file.path}`,
      name: file.name,
      path: file.path,
      sourceId: source.id,
      sourceName: source.name,
      isDirectory: file.mimeType === 'folder' || file.path.endsWith('/'),
      addedAt: new Date().toISOString(),
      order: favorites.length,
    };

    // Check if already exists
    if (favorites.some((f) => f.id === newFavorite.id)) {
      return;
    }

    const updated = [...favorites, newFavorite];
    setFavorites(updated);
    saveGlobalFavorites(updated);
  };

  // Remove from global favorites
  const removeFromGlobalFavorites = (favoriteId: string) => {
    const updated = favorites.filter((f) => f.id !== favoriteId);
    setFavorites(updated);
    saveGlobalFavorites(updated);
  };

  const loadTags = async (sourceId: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const tagList = await invoke<{ name: string; color?: string }[]>(
        'vfs_list_all_tags',
        { sourceId },
      );
      setAllTags(tagList);
    } catch (err) {
      console.error('Failed to load tags:', err);
      setAllTags([]);
    }
  };

  // Load global favorites on mount
  useEffect(() => {
    loadGlobalFavorites();
  }, []);

  // Load tags when source changes
  useEffect(() => {
    if (selectedSource) {
      loadTags(selectedSource.id);
    }
  }, [selectedSource]);

  // Select a source (storage location) and navigate to its root
  const selectSource = async (source: StorageSource) => {
    // Skip if same source already selected
    if (selectedSource?.id === source.id) return;

    console.log('[VFS] Selecting source:', source.id, source.name);

    // Clear state first
    setSelectedFiles(new Set());
    setFiles([]); // Clear files immediately to show loading

    // Reset navigation history when switching sources
    setNavigationHistory(['']);
    setHistoryIndex(0);

    // Update source and path
    setSelectedSource(source);
    setCurrentPath('');

    // Explicitly load files for the new source (don't rely on useEffect)
    // This ensures files load immediately even if currentPath was already ''
    await loadFilesList(source.id, '');
  };

  // Navigate to a path and update history
  const navigateTo = (path: string, addToHistory = true) => {
    // Normalize path
    const normalizedPath = path === '/' ? '' : path;

    // Don't navigate if already at this path
    if (normalizedPath === currentPath) return;

    setCurrentPath(normalizedPath);
    setSelectedFiles(new Set());

    // Add to history if this is a new navigation (not back/forward)
    if (addToHistory) {
      setNavigationHistory((prev) => {
        // Remove any forward history
        const newHistory = prev.slice(0, historyIndex + 1);
        // Add new path
        newHistory.push(normalizedPath);
        // Keep history manageable (max 50 entries)
        if (newHistory.length > 50) newHistory.shift();
        return newHistory;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 49));
    }
  };

  // Go back in navigation history
  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const path = navigationHistory[newIndex] || '';
      setCurrentPath(path);
      setSelectedFiles(new Set());
    }
  };

  // Go forward in navigation history
  const goForward = () => {
    if (historyIndex < navigationHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const path = navigationHistory[newIndex] || '';
      setCurrentPath(path);
      setSelectedFiles(new Set());
    }
  };

  // Go up one directory level
  const goUp = () => {
    if (!currentPath) return;

    // Handle different path formats
    let parentPath = '';

    if (currentPath.includes('/')) {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      parentPath = parts.length > 0 ? '/' + parts.join('/') : '';
    } else if (currentPath.includes('\\')) {
      const parts = currentPath.split('\\').filter(Boolean);
      parts.pop();
      parentPath = parts.length > 0 ? parts.join('\\') : '';
    }

    navigateTo(parentPath);
  };

  // Check if we can go back/forward
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < navigationHistory.length - 1;
  const canGoUp = currentPath !== '';

  const handleFileClick = (file: FileMetadata, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        if (next.has(file.path)) next.delete(file.path);
        else next.add(file.path);
        return next;
      });
    } else if (e.shiftKey && selectedFiles.size > 0) {
      // Range selection
      const allPaths = files.map((f) => f.path);
      const lastSelected = Array.from(selectedFiles).pop();
      if (!lastSelected) return;
      const lastIdx = allPaths.indexOf(lastSelected);
      const currentIdx = allPaths.indexOf(file.path);
      const [start, end] = [
        Math.min(lastIdx, currentIdx),
        Math.max(lastIdx, currentIdx),
      ];
      const range = allPaths.slice(start, end + 1);
      setSelectedFiles(new Set(range));
    } else {
      setSelectedFiles(new Set([file.path]));
    }
  };

  const handleFileDoubleClick = async (file: FileMetadata) => {
    const isFolder =
      file.mimeType === 'folder' || file.path.endsWith('/') || file.isDirectory;

    if (isFolder) {
      // Build the full path for the folder
      let targetPath = file.path;

      // Remove trailing slash if present
      if (targetPath.endsWith('/')) {
        targetPath = targetPath.slice(0, -1);
      }

      // If the path is relative (doesn't start with / or drive letter), make it absolute
      if (
        currentPath &&
        !targetPath.startsWith('/') &&
        !targetPath.match(/^[A-Za-z]:\\/)
      ) {
        targetPath = currentPath + '/' + file.name;
      }

      console.log('[VFS] Navigating to folder:', targetPath);
      navigateTo(targetPath);
    } else {
      // Open file with default application
      await handleOpenFile(file);
    }
  };

  // Open file with default application
  const handleOpenFile = async (file: FileMetadata) => {
    if (!selectedSource) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('vfs_open_file', {
        sourceId: selectedSource.id,
        filePath: file.path,
      });
    } catch (err) {
      console.error('Failed to open file:', err);
      DialogService.error(`Failed to open file: ${err}`, 'Open Error');
    }
  };

  // Open file with specific application
  const handleOpenFileWith = async (file: FileMetadata, appPath: string) => {
    if (!selectedSource) {
      DialogService.error('No storage source selected', 'Open Error');
      return;
    }

    if (!appPath || appPath.trim() === '') {
      DialogService.error('No application selected', 'Open Error');
      return;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // On macOS, normalize .app bundle paths
      // The dialog might return the executable path inside the bundle, but we need the .app bundle path
      let normalizedAppPath = appPath.trim();

      if (navigator.platform.includes('Mac')) {
        // If path contains .app/Contents/MacOS, extract just the .app bundle path
        const appBundleMatch = normalizedAppPath.match(/^(.+\.app)/);
        if (appBundleMatch) {
          normalizedAppPath = appBundleMatch[1];
        }
        // Ensure it ends with .app
        if (!normalizedAppPath.endsWith('.app')) {
          // Try to find the .app bundle in the path
          const parts = normalizedAppPath.split('/');
          const appIndex = parts.findIndex((part) => part.endsWith('.app'));
          if (appIndex !== -1) {
            normalizedAppPath = parts.slice(0, appIndex + 1).join('/');
          }
        }
      }

      await invoke('vfs_open_file_with', {
        sourceId: selectedSource.id,
        filePath: file.path,
        appPath: normalizedAppPath,
      });
    } catch (err) {
      console.error('Failed to open file with app:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      DialogService.error(
        `Failed to open file with application: ${errorMessage}`,
        'Open Error',
      );
    }
  };

  // Get available apps for a file
  const [availableApps, setAvailableApps] = useState<
    { name: string; path: string }[]
  >([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [showOpenWith, setShowOpenWith] = useState(false);

  const loadAppsForFile = async (file: FileMetadata) => {
    setAppsLoading(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const apps = await invoke<
        { name: string; path: string; bundle_id?: string }[]
      >('vfs_get_apps_for_file', {
        filePath: file.path,
      });

      // Deduplicate apps on frontend as safety measure
      // Check by bundle_id, path, and name (case-insensitive)
      const seen = new Set<string>();
      const deduplicated = apps.filter((app) => {
        // Check by bundle_id first (most reliable)
        if (app.bundle_id) {
          const key = `bundle:${app.bundle_id}`;
          if (seen.has(key)) return false;
          seen.add(key);
        }

        // Check by normalized path
        const normalizedPath = app.path.toLowerCase().replace(/\/$/, '');
        const pathKey = `path:${normalizedPath}`;
        if (seen.has(pathKey)) return false;
        seen.add(pathKey);

        // Check by name (case-insensitive) as fallback
        const nameKey = `name:${app.name.toLowerCase()}`;
        if (seen.has(nameKey)) return false;
        seen.add(nameKey);

        return true;
      });

      setAvailableApps(deduplicated);
    } catch (err) {
      console.error('Failed to get apps:', err);
      setAvailableApps([]);
    } finally {
      setAppsLoading(false);
    }
  };

  const handleWarm = async (file: FileMetadata) => {
    if (!selectedSource) return;
    try {
      await StorageService.warmFile({
        sourceId: selectedSource.id,
        filePath: file.path,
        priority: 'high',
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleTranscode = async (file: FileMetadata) => {
    if (!selectedSource) return;
    try {
      await StorageService.transcodeVideo({
        sourceId: selectedSource.id,
        filePath: file.path,
        format: 'hls',
      });
    } catch (err) {
      console.error(err);
    }
  };

  // =========================================================================
  // Clipboard Operations - macOS Finder-like behavior
  // =========================================================================

  // Centralized function to refresh clipboard state
  const refreshClipboardState = async () => {
    try {
      // Check VFS clipboard
      const hasVfsFiles = await StorageService.hasClipboardFiles();
      setClipboardHasFiles(hasVfsFiles);

      // Check native clipboard for files from Finder
      const nativeFiles = await StorageService.readNativeClipboard();
      setNativeClipboardCount(nativeFiles.length);
    } catch (err) {
      console.error('Failed to refresh clipboard state:', err);
    }
  };

  const handleCopy = async () => {
    if (!selectedSource || selectedFiles.size === 0) return;

    setFileOperation({ type: 'Copying to clipboard...', inProgress: true });

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const paths = Array.from(selectedFiles);

      console.log('[VFS Copy] Copying paths:', paths);
      console.log('[VFS Copy] Source:', selectedSource.id);

      // Copy to VFS clipboard AND export to native clipboard for Finder/Explorer
      const result = await invoke('vfs_clipboard_copy_for_native', {
        sourceId: selectedSource.id,
        paths,
      });
      console.log('[VFS Copy] Result:', result);

      setClipboardHasFiles(true);

      // Brief visual feedback
      setFileOperation({
        type: `${paths.length} item(s) copied`,
        inProgress: false,
      });
      setTimeout(() => setFileOperation(null), 1500);
    } catch (err) {
      console.error('[VFS Copy] Failed:', err);
      setFileOperation(null);
    }
  };

  // Cut operation removed - keeping it simple like macOS Finder (copy/paste only)

  const handlePaste = async (targetPath?: string) => {
    if (!selectedSource) return;

    const destination = targetPath || currentPath || '/';

    console.log('[VFS Paste] Starting paste to:', destination);
    setFileOperation({ type: 'Pasting...', inProgress: true });

    try {
      // Check if we have files in VFS clipboard
      let hasFiles = await StorageService.hasClipboardFiles();
      console.log('[VFS Paste] hasClipboardFiles:', hasFiles);

      // If not, check native clipboard (files copied from Finder)
      if (!hasFiles) {
        const nativeFiles = await StorageService.readNativeClipboard();
        console.log('[VFS Paste] Native clipboard files:', nativeFiles);
        if (nativeFiles.length > 0) {
          await StorageService.copyNativeToClipboard(nativeFiles);
          hasFiles = true;
        }
      }

      if (!hasFiles) {
        console.log('[VFS Paste] No files to paste, aborting');
        setFileOperation(null);
        return;
      }

      console.log(
        '[VFS Paste] Calling pasteFiles:',
        selectedSource.id,
        destination,
      );
      const result = await StorageService.pasteFiles(
        selectedSource.id,
        destination,
      );
      console.log('[VFS Paste] Result:', result);

      // Refresh UI after paste
      await loadFilesList(selectedSource.id, currentPath);

      if (result.files_pasted > 0) {
        setFileOperation({
          type: `${result.files_pasted} item(s) pasted`,
          inProgress: false,
        });
        setTimeout(() => setFileOperation(null), 1500);
      } else if (result.errors && result.errors.length > 0) {
        console.error('[VFS Paste] Errors:', result.errors);
        setFileOperation({
          type: `Paste failed: ${result.errors[0]}`,
          inProgress: false,
        });
        setTimeout(() => setFileOperation(null), 3000);
      } else {
        console.log('[VFS Paste] No files pasted and no errors');
        setFileOperation(null);
      }

      await refreshClipboardState();
    } catch (err) {
      console.error('[VFS Paste] Failed:', err);
      setFileOperation({ type: `Paste failed: ${err}`, inProgress: false });
      setTimeout(() => setFileOperation(null), 3000);
    }
  };

  const handleDelete = async () => {
    if (!selectedSource || selectedFiles.size === 0) return;

    const paths = Array.from(selectedFiles);
    const confirmDelete = window.confirm(
      `Delete ${paths.length} file(s)? This cannot be undone.`,
    );
    if (!confirmDelete) return;

    setFileOperation({
      inProgress: true,
      type: `Deleting ${paths.length} item(s)`,
    });

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const failedPaths: string[] = [];

      for (const path of paths) {
        try {
          // Normalize the path - ensure it doesn't have double slashes
          const normalizedPath = path.replace(/\/+/g, '/');

          console.log(
            `[VFS Delete] Deleting: sourceId=${selectedSource.id}, path=${normalizedPath}`,
          );

          const result = await invoke('vfs_delete_recursive', {
            sourceId: selectedSource.id,
            path: normalizedPath,
          });

          console.log(`[VFS Delete] Result:`, result);
        } catch (err) {
          console.error(`[VFS Delete] Failed to delete ${path}:`, err);
          failedPaths.push(path);
        }
      }

      // Clear selection
      setSelectedFiles(new Set());

      // Refresh file list
      await loadFilesList(selectedSource.id, currentPath);

      // Show error if some deletions failed
      if (failedPaths.length > 0) {
        DialogService.error(
          `Failed to delete ${failedPaths.length} item(s):\n${failedPaths.join('\n')}`,
          'Delete Error',
        );
      }
    } catch (err) {
      console.error('[VFS Delete] Delete operation failed:', err);
      DialogService.error(`Delete failed: ${err}`, 'Delete Error');
    } finally {
      setFileOperation(null);
    }
  };

  // Rename file/folder
  // Start inline rename (like macOS Finder)
  const handleRename = (file: FileMetadata) => {
    // Get file name without extension for pre-selection
    const name = file.name;
    const dotIndex = name.lastIndexOf('.');
    const isFolder = file.mimeType === 'folder' || file.path.endsWith('/');

    setRenamingFile(file.path);
    setRenameValue(name);
    setSelectedFiles(new Set([file.path]));

    // Focus and select the name (without extension for files)
    setTimeout(() => {
      if (renameInputRef.current) {
        renameInputRef.current.focus();
        if (!isFolder && dotIndex > 0) {
          renameInputRef.current.setSelectionRange(0, dotIndex);
        } else {
          renameInputRef.current.select();
        }
      }
    }, 10);
  };

  // Commit the rename
  const commitRename = async () => {
    if (!selectedSource || !renamingFile) return;

    const file = files.find((f) => f.path === renamingFile);
    if (!file) {
      setRenamingFile(null);
      return;
    }

    const newName = renameValue.trim();
    if (!newName || newName === file.name) {
      setRenamingFile(null);
      return;
    }

    // Validate name
    if (newName.includes('/') || newName.includes('\\')) {
      DialogService.warning(
        'File names cannot contain slashes',
        'Invalid Name',
      );
      return;
    }

    setFileOperation({ type: 'Renaming...', inProgress: true });

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // Construct the new path
      const pathParts = file.path.split('/');
      pathParts.pop();
      const newPath =
        pathParts.length > 0
          ? `${pathParts.join('/')}/${newName}`
          : `/${newName}`;

      await invoke('vfs_rename', {
        sourceId: selectedSource.id,
        from: file.path,
        to: newPath,
      });

      setRenamingFile(null);

      // Refresh and select the renamed file
      await loadFilesList(selectedSource.id, currentPath);
      setSelectedFiles(new Set([newPath]));
    } catch (err) {
      console.error('Rename failed:', err);
      DialogService.error(`Rename failed: ${err}`, 'Rename Error');
    } finally {
      setFileOperation(null);
    }
  };

  // Cancel rename
  const cancelRename = () => {
    setRenamingFile(null);
    setRenameValue('');
  };

  // Handle rename input keydown
  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelRename();
    }
  };

  // Create new folder with inline naming (like macOS Finder)
  // Optional targetPath for creating inside a specific folder
  const handleNewFolder = async (targetPath?: string) => {
    if (!selectedSource) return;

    setFileOperation({ type: 'Creating folder...', inProgress: true });

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // Determine the parent directory
      const parentPath = targetPath || currentPath;

      // Find a unique name
      let folderName = 'untitled folder';
      let counter = 1;
      const existingNames = new Set(files.map((f) => f.name.toLowerCase()));

      while (existingNames.has(folderName.toLowerCase())) {
        counter++;
        folderName = `untitled folder ${counter}`;
      }

      const newPath =
        parentPath === '/' || parentPath === ''
          ? `/${folderName}`
          : `${parentPath.replace(/\/$/, '')}/${folderName}`;

      await invoke('vfs_mkdir', {
        sourceId: selectedSource.id,
        path: newPath,
      });

      // Refresh file list and wait for it to complete
      await loadFilesList(selectedSource.id, currentPath);

      // Set state for renaming immediately
      setRenamingFile(newPath);
      setRenameValue(folderName);
      setSelectedFiles(new Set([newPath]));

      // Use requestAnimationFrame for proper DOM timing
      // This ensures React has re-rendered with the new folder
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Scroll the new folder into view
          const folderElement = document.querySelector(
            `[data-path="${CSS.escape(newPath)}"]`,
          );
          if (folderElement) {
            folderElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }

          // Focus and select the rename input
          if (renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
          }
        });
      });
    } catch (err) {
      console.error('Create folder failed:', err);
      DialogService.error(`Create folder failed: ${err}`, 'Folder Error');
    } finally {
      setFileOperation(null);
    }
  };

  // Duplicate file/folder - Cmd+D
  const handleDuplicate = async (file: FileMetadata) => {
    if (!selectedSource) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // Generate copy name (e.g., "file.txt" -> "file copy.txt" or "file copy 2.txt")
      const nameParts = file.name.split('.');
      const ext =
        nameParts.length > 1 ? '.' + nameParts[nameParts.length - 1] : '';
      const baseName = file.name.includes('.')
        ? file.name.substring(0, file.name.lastIndexOf('.'))
        : file.name;

      // Check for existing copies to generate unique name
      const copyPattern = new RegExp(
        `^${baseName} copy( \\d+)?${ext.replace('.', '\\.')}$`,
      );
      const existingCopies = files.filter((f) => copyPattern.test(f.name));

      const copyNum = existingCopies.length > 0 ? existingCopies.length + 1 : 0;
      const newName =
        copyNum > 0
          ? `${baseName} copy ${copyNum}${ext}`
          : `${baseName} copy${ext}`;

      const pathParts = file.path.split('/');
      pathParts.pop();
      const newPath =
        pathParts.length > 0
          ? `${pathParts.join('/')}/${newName}`
          : `/${newName}`;

      await invoke('vfs_copy', {
        sourceId: selectedSource.id,
        request: {
          from: file.path,
          to: newPath,
          recursive: true,
        },
      });

      // Refresh file list
      await loadFilesList(selectedSource.id, currentPath);
    } catch (err) {
      console.error('Duplicate failed:', err);
      DialogService.error(`Duplicate failed: ${err}`, 'Duplicate Error');
    }
  };

  // ============================================================================
  // Drag and Drop Handlers - Native FS-like behavior
  // ============================================================================

  // Start dragging file(s)
  const handleDragStart = (e: React.DragEvent, file: FileMetadata) => {
    // If dragging a non-selected file, select only that file
    const filesToDrag = selectedFiles.has(file.path)
      ? Array.from(selectedFiles)
      : [file.path];

    // Get full file objects for the dragged files
    const fileObjects = filesToDrag
      .map((path) => files.find((f) => f.path === path))
      .filter((f): f is FileMetadata => f !== undefined);

    // If dragging a single non-selected file, use that file directly
    if (!selectedFiles.has(file.path)) {
      fileObjects.length = 0;
      fileObjects.push(file);
    }

    console.log(
      '[VFS DnD] Drag start:',
      filesToDrag,
      'objects:',
      fileObjects.length,
      'from source:',
      selectedSource?.id,
    );

    setDraggedFiles(filesToDrag);
    setDraggedFileObjects(fileObjects);
    setDragSourceId(selectedSource?.id || null);

    // Set drag data for native drop targets (Finder/Explorer)
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', filesToDrag.join('\n'));
    e.dataTransfer.setData(
      'application/x-vfs-files',
      JSON.stringify({
        sourceId: selectedSource?.id,
        paths: filesToDrag,
      }),
    );

    // Create custom drag image showing file count (uses CSS from finder.css)
    const dragImage = document.createElement('div');
    dragImage.className = 'drag-ghost';
    dragImage.innerHTML = `
      ${filesToDrag.length > 1 ? `<span class="drag-count">${filesToDrag.length}</span>` : ''}
      <span class="drag-label">${filesToDrag.length === 1 ? file.name : `${filesToDrag.length} items`}</span>
    `;
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 20, 20);

    // Clean up after a short delay (must stay in DOM for setDragImage to work)
    requestAnimationFrame(() => {
      setTimeout(() => dragImage.remove(), 0);
    });
  };

  // Drag over a folder or content area
  const handleDragOver = (
    e: React.DragEvent,
    targetPath?: string,
    isFolder?: boolean,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Determine drop effect
    const isMove = e.shiftKey || dragSourceId === selectedSource?.id;
    e.dataTransfer.dropEffect = isMove ? 'move' : 'copy';

    setIsDraggingOver(true);

    // Only set folder as drop target (not individual files)
    if (isFolder && targetPath !== undefined) {
      setDropTarget(targetPath);
    } else if (targetPath === undefined) {
      // Dragging over empty area in the content view
      setDropTarget(null);
    }
  };

  // Drag leaves the drop zone
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only clear drop target when truly leaving (not entering a child element)
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;

    // Check if we're leaving to an element outside the current target
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      setDropTarget(null);
      setIsDraggingOver(false);
    }
  };

  // Drop files onto target
  const handleDrop = async (
    e: React.DragEvent,
    targetPath: string = currentPath,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('[VFS DnD] Drop event, target:', targetPath);

    setDropTarget(null);
    setIsDraggingOver(false);

    if (!selectedSource) {
      console.warn('[VFS DnD] No selected source');
      return;
    }

    // Use the internal draggedFiles state first (more reliable than dataTransfer)
    // dataTransfer.getData() can be unreliable in some browsers during drop
    const filesToMove = draggedFiles.length > 0 ? draggedFiles : [];
    const sourceId = dragSourceId || selectedSource.id;

    // Also try to get from dataTransfer as fallback
    const vfsData = e.dataTransfer.getData('application/x-vfs-files');

    if (filesToMove.length > 0 || vfsData) {
      // VFS internal drag
      try {
        const paths =
          filesToMove.length > 0
            ? filesToMove
            : (JSON.parse(vfsData) as { sourceId: string; paths: string[] })
                .paths;

        console.log(
          '[VFS DnD] Moving/copying paths:',
          paths,
          'to:',
          targetPath,
        );

        // Default to move within same source, copy between sources
        const isMove = sourceId === selectedSource.id;
        const { invoke } = await import('@tauri-apps/api/core');

        for (const path of paths) {
          // Don't drop onto self or parent
          if (path === targetPath || targetPath.startsWith(path + '/')) {
            console.log('[VFS DnD] Skipping self/parent drop:', path);
            continue;
          }

          const fileName = path.split('/').pop() || '';
          // Handle empty targetPath (root)
          const normalizedTarget = targetPath === '' ? '/' : targetPath;
          const destPath =
            normalizedTarget === '/'
              ? `/${fileName}`
              : `${normalizedTarget}/${fileName}`;

          console.log(
            '[VFS DnD] Operation:',
            isMove ? 'move' : 'copy',
            'from:',
            path,
            'to:',
            destPath,
          );

          if (sourceId === selectedSource.id) {
            // Same source: move within the source
            if (isMove) {
              await invoke('vfs_move', {
                sourceId,
                request: { from: path, to: destPath },
              });
            } else {
              await invoke('vfs_copy', {
                sourceId,
                request: { from: path, to: destPath, recursive: true },
              });
            }
          } else {
            // Different source: cross-storage transfer
            if (isMove) {
              await invoke('vfs_move_to_source', {
                fromSourceId: sourceId,
                fromPath: path,
                toSourceId: selectedSource.id,
                toPath: destPath,
              });
            } else {
              await invoke('vfs_copy_to_source', {
                fromSourceId: sourceId,
                fromPath: path,
                toSourceId: selectedSource.id,
                toPath: destPath,
              });
            }
          }
        }

        // Refresh file list
        console.log('[VFS DnD] Refreshing files');
        await loadFilesList(selectedSource.id, currentPath);
      } catch (err) {
        console.error('[VFS DnD] Drop failed:', err);
        DialogService.error(`Drop failed: ${err}`, 'Drop Error');
      }
    } else if (e.dataTransfer.files.length > 0) {
      // Native file drop - import from filesystem
      console.log(
        '[VFS DnD] Native file drop:',
        e.dataTransfer.files.length,
        'files',
      );
      try {
        const { invoke } = await import('@tauri-apps/api/core');

        for (const file of Array.from(e.dataTransfer.files)) {
          // Use Tauri's file path if available
          const filePath = (file as unknown as { path?: string }).path;
          if (filePath) {
            const fileName = filePath.split('/').pop() || file.name;
            const normalizedTarget = targetPath === '' ? '/' : targetPath;
            const destPath =
              normalizedTarget === '/'
                ? `/${fileName}`
                : `${normalizedTarget}/${fileName}`;

            console.log('[VFS DnD] Native import:', filePath, 'to:', destPath);

            await invoke('vfs_copy_to_source', {
              fromSourceId: 'native',
              fromPath: filePath,
              toSourceId: selectedSource.id,
              toPath: destPath,
            });
          }
        }

        // Refresh
        await loadFilesList(selectedSource.id, currentPath);
      } catch (err) {
        console.error('[VFS DnD] Import from native failed:', err);
        DialogService.error(`Import failed: ${err}`, 'Import Error');
      }
    } else {
      console.log('[VFS DnD] No files to drop');
    }

    // Clean up drag state
    setDraggedFiles([]);
    setDraggedFileObjects([]);
    setDragSourceId(null);
  };

  // Drag ends (cleanup)
  const handleDragEnd = () => {
    setDraggedFiles([]);
    setDraggedFileObjects([]);
    setDragSourceId(null);
    setDropTarget(null);
    setIsDraggingOver(false);
  };

  // Drop onto sidebar source (cross-storage transfer)
  const handleDropOnSource = async (
    e: React.DragEvent,
    targetSource: StorageSource,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const vfsData = e.dataTransfer.getData('application/x-vfs-files');
    if (!vfsData) return;

    try {
      const { sourceId, paths } = JSON.parse(vfsData) as {
        sourceId: string;
        paths: string[];
      };
      const isMove = e.shiftKey;
      const { invoke } = await import('@tauri-apps/api/core');

      for (const path of paths) {
        const fileName = path.split('/').pop() || '';
        const destPath = `/${fileName}`;

        if (isMove) {
          await invoke('vfs_move_to_source', {
            fromSourceId: sourceId,
            fromPath: path,
            toSourceId: targetSource.id,
            toPath: destPath,
          });
        } else {
          await invoke('vfs_copy_to_source', {
            fromSourceId: sourceId,
            fromPath: path,
            toSourceId: targetSource.id,
            toPath: destPath,
          });
        }
      }

      // Optionally switch to target source
      // setSelectedSource(targetSource);
      // await loadFilesList(targetSource.id, '/');
    } catch (err) {
      console.error('Cross-storage drop failed:', err);
      DialogService.error(`Transfer failed: ${err}`, 'Transfer Error');
    }

    setDraggedFiles([]);
    setDraggedFileObjects([]);
    setDragSourceId(null);
    setDropTarget(null);
    setIsDraggingOver(false);
  };

  // Toggle favorite for a file
  const handleToggleFavorite = async (filePath: string) => {
    if (!selectedSource) return;

    const file = files.find((f) => f.path === filePath);
    if (!file) return;

    const favoriteId = `${selectedSource.id}:${filePath}`;
    const existingIndex = favorites.findIndex((f) => f.id === favoriteId);

    if (existingIndex >= 0) {
      // Remove from favorites
      removeFromGlobalFavorites(favoriteId);
    } else {
      // Add to favorites
      addToGlobalFavorites(file, selectedSource);
    }
  };

  // Check if a file is in favorites
  const isFileFavorite = (filePath: string): boolean => {
    if (!selectedSource) return false;
    const favoriteId = `${selectedSource.id}:${filePath}`;
    return favorites.some((f) => f.id === favoriteId);
  };

  // Navigate to a favorite
  const navigateToFavorite = async (favorite: GlobalFavorite) => {
    // First, find and select the source
    const source = sources.find((s) => s.id === favorite.sourceId);
    if (source) {
      setSelectedSource(source);
    }

    // Get directory of the favorite
    const parts = favorite.path.split('/');
    if (!favorite.isDirectory) {
      parts.pop(); // Remove filename
    }
    const dirPath = parts.join('/') || '/';
    setCurrentPath(dirPath);

    // Select the file after navigation
    if (!favorite.isDirectory) {
      setTimeout(() => {
        setSelectedFiles(new Set([favorite.path]));
      }, 100);
    }
  };

  // Handle adding a new storage source
  const handleAddStorage = async (sourceConfig: Partial<StorageSource>) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // Register the new storage source with the backend
      const newSource = await invoke<StorageSource>('vfs_add_source', {
        source: sourceConfig,
      });

      // Add to sources list
      setSources((prev) => [...prev, newSource]);

      // Optionally select the new source
      setSelectedSource(newSource);
      setCurrentPath('/');
    } catch (err) {
      console.error('Failed to add storage:', err);
      DialogService.error(`Failed to add storage: ${err}`, 'Storage Error');
    }
  };

  // Context menu handlers
  const handleContextMenu = async (
    e: React.MouseEvent,
    file?: FileMetadata,
  ) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent bubbling to parent containers

    // If right-clicking on a file that's not selected, select it
    if (file && !selectedFiles.has(file.path)) {
      setSelectedFiles(new Set([file.path]));
    }

    // Check clipboard (both VFS and native)
    try {
      const hasVfsFiles = await StorageService.hasClipboardFiles();
      const nativeFiles = await StorageService.readNativeClipboard();

      setNativeClipboardCount(nativeFiles.length);
      setClipboardHasFiles(hasVfsFiles || nativeFiles.length > 0);
    } catch (err) {
      console.error('Failed to check clipboard:', err);
      setClipboardHasFiles(false);
      setNativeClipboardCount(0);
    }

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetFile: file,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  };

  // Close context menus on click anywhere
  useEffect(() => {
    const handleClick = () => {
      closeContextMenu();
      setStorageContextMenu(null);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  /**
   * Build breadcrumbs that work across different storage types:
   * - Local: /Users/tony/Documents -> [Home, Documents]
   * - S3: bucket/prefix/key -> [bucket, prefix, key]
   * - Network (SMB/NFS): //server/share/folder or /Volumes/Share/folder
   */
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    // SVG icon components using theme colors
    const LocalIcon = () => (
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="breadcrumb-icon location"
      >
        <path d="M4.5 5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM3 4.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" />
        <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H8.5v3a1.5 1.5 0 0 1 1.5 1.5h5.5a.5.5 0 0 1 0 1H10A1.5 1.5 0 0 1 8.5 14h-1A1.5 1.5 0 0 1 6 12.5H.5a.5.5 0 0 1 0-1H6A1.5 1.5 0 0 1 7.5 10V7H2a2 2 0 0 1-2-2V4zm1 0v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1zm6 7.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5z" />
      </svg>
    );
    const CloudIcon = () => (
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="breadcrumb-icon location"
      >
        <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z" />
      </svg>
    );
    const NetworkIcon = () => (
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="breadcrumb-icon location"
      >
        <path d="M6.5 9a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5h-3zM5 8.5A1.5 1.5 0 0 1 6.5 7h3A1.5 1.5 0 0 1 11 8.5v2A1.5 1.5 0 0 1 9.5 12h-3A1.5 1.5 0 0 1 5 10.5v-2z" />
        <path d="M1.5 1a.5.5 0 0 0-.5.5v3a.5.5 0 0 1-1 0v-3A1.5 1.5 0 0 1 1.5 0h3a.5.5 0 0 1 0 1h-3zm11 0a.5.5 0 0 0 0-1h3A1.5 1.5 0 0 1 16 1.5v3a.5.5 0 0 1-1 0v-3a.5.5 0 0 0-.5-.5h-3zM.5 11a.5.5 0 0 1 .5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 1 0 1h-3A1.5 1.5 0 0 1 0 14.5v-3a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a.5.5 0 0 1 0-1h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 1 .5-.5z" />
        <path d="M3 6.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5z" />
      </svg>
    );
    const HybridIcon = () => (
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="breadcrumb-icon location"
      >
        <path d="M5 0a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1H5zm.5 14a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm2 0a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zM5 1.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zM5.5 3h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1zm0 2h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1zm0 2h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1zm0 2h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1z" />
      </svg>
    );
    const FolderIcon = () => (
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="breadcrumb-icon folder"
      >
        <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3H13.5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H2.5a2 2 0 0 1-2-2V3.87z" />
      </svg>
    );

    if (!selectedSource)
      return [{ name: 'Root', path: '', icon: <LocalIcon /> }];

    const storageType =
      selectedSource.providerId || selectedSource.type || 'local';
    const sourceName = selectedSource.name || 'Storage';

    // Root breadcrumb with storage-specific icon
    const getStorageIcon = (): React.ReactNode => {
      switch (storageType) {
        case 'aws-s3':
        case 's3':
        case 's3-compatible':
        case 'gcs':
        case 'azure-blob':
          return <CloudIcon />;
        case 'smb':
        case 'nfs':
        case 'nas':
          return <NetworkIcon />;
        case 'fsx-ontap':
          return <HybridIcon />;
        case 'sftp':
        case 'webdav':
          return <NetworkIcon />;
        default:
          return <LocalIcon />;
      }
    };

    const crumbs: BreadcrumbItem[] = [
      {
        name: sourceName,
        path: '',
        icon: getStorageIcon(),
      },
    ];

    if (!currentPath || currentPath === '/' || currentPath === '') {
      return crumbs;
    }

    // Parse path based on storage type
    let pathParts: string[] = [];

    if (
      storageType === 'aws-s3' ||
      storageType === 's3' ||
      storageType === 'gcs' ||
      storageType === 'azure-blob'
    ) {
      // Object storage: bucket/prefix/key format (no leading slash)
      pathParts = currentPath.replace(/^\/+/, '').split('/').filter(Boolean);
    } else if (storageType === 'smb' || storageType === 'nfs') {
      // Network paths: handle //server/share or UNC paths
      const cleanPath = currentPath.replace(/^\/\//, '').replace(/^\\\\/, '');
      pathParts = cleanPath.split(/[/\\]/).filter(Boolean);
    } else {
      // Local/default: standard Unix path
      pathParts = currentPath.split('/').filter(Boolean);
    }

    // Build accumulated paths for navigation
    let accumulated = '';
    const pathSeparator =
      storageType === 'smb' && currentPath.startsWith('\\\\') ? '\\' : '/';

    for (const part of pathParts) {
      accumulated = accumulated
        ? `${accumulated}${pathSeparator}${part}`
        : `/${part}`;
      crumbs.push({
        name: part,
        path: accumulated,
        icon: <FolderIcon />,
      });
    }

    return crumbs;
  };

  // Check if current storage is mounted/local (files directly accessible)
  // Transcode and Download features only make sense for remote/cloud storage
  const isMountedStorage = (): boolean => {
    if (!selectedSource) return true; // Default to true if no source
    const category = selectedSource.category;
    // Local, network, and hybrid with mount points are considered mounted
    return (
      category === 'local' || category === 'network' || category === 'block'
    );
  };

  // Parse search query for DAM/MAM search operators
  // Supports: tag:, type:, tier:, ext:, is:, size:, modified:
  const parseSearchQuery = (
    query: string,
  ): {
    textSearch: string;
    tagFilter?: string;
    typeFilter?: string;
    tierFilter?: string;
    extFilter?: string;
    isFilter?: string;
    sizeFilter?: string;
    modifiedFilter?: string;
  } => {
    let textSearch = query;
    let tagFilter: string | undefined;
    let typeFilter: string | undefined;
    let tierFilter: string | undefined;
    let extFilter: string | undefined;
    let isFilter: string | undefined;
    let sizeFilter: string | undefined;
    let modifiedFilter: string | undefined;

    // Extract tag: operator
    const tagMatch = query.match(/tag:(\S+)/i);
    if (tagMatch) {
      tagFilter = tagMatch[1].toLowerCase();
      textSearch = textSearch.replace(tagMatch[0], '').trim();
    }

    // Extract type: operator
    const typeMatch = query.match(/type:(\S+)/i);
    if (typeMatch) {
      typeFilter = typeMatch[1].toLowerCase();
      textSearch = textSearch.replace(typeMatch[0], '').trim();
    }

    // Extract tier: operator
    const tierMatch = query.match(/tier:(\S+)/i);
    if (tierMatch) {
      tierFilter = tierMatch[1].toLowerCase();
      textSearch = textSearch.replace(tierMatch[0], '').trim();
    }

    // Extract ext: operator
    const extMatch = query.match(/ext:(\S+)/i);
    if (extMatch) {
      extFilter = extMatch[1].toLowerCase().replace(/^\./, ''); // Remove leading dot
      textSearch = textSearch.replace(extMatch[0], '').trim();
    }

    // Extract is: operator
    const isMatch = query.match(/is:(\S+)/i);
    if (isMatch) {
      isFilter = isMatch[1].toLowerCase();
      textSearch = textSearch.replace(isMatch[0], '').trim();
    }

    // Extract size: operator
    const sizeMatch = query.match(/size:(\S+)/i);
    if (sizeMatch) {
      sizeFilter = sizeMatch[1].toLowerCase();
      textSearch = textSearch.replace(sizeMatch[0], '').trim();
    }

    // Extract modified: operator
    const modifiedMatch = query.match(/modified:(\S+)/i);
    if (modifiedMatch) {
      modifiedFilter = modifiedMatch[1].toLowerCase();
      textSearch = textSearch.replace(modifiedMatch[0], '').trim();
    }

    return {
      textSearch,
      tagFilter,
      typeFilter,
      tierFilter,
      extFilter,
      isFilter,
      sizeFilter,
      modifiedFilter,
    };
  };

  // Helper to parse size filter (e.g., ">10mb", "<1gb")
  const matchesSizeFilter = (size: number, filter: string): boolean => {
    const match = filter.match(/^([<>]=?)(\d+(?:\.\d+)?)(kb|mb|gb|tb)?$/i);
    if (!match) return true;

    const [, op, numStr, unit = 'b'] = match;
    const num = parseFloat(numStr);
    const multipliers: Record<string, number> = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
      tb: 1024 * 1024 * 1024 * 1024,
    };
    const threshold = num * (multipliers[unit.toLowerCase()] || 1);

    switch (op) {
      case '>':
        return size > threshold;
      case '>=':
        return size >= threshold;
      case '<':
        return size < threshold;
      case '<=':
        return size <= threshold;
      default:
        return size > threshold;
    }
  };

  // Helper to check modified date filter
  const matchesModifiedFilter = (
    modifiedDate: string | undefined,
    filter: string,
  ): boolean => {
    if (!modifiedDate) return false;

    const fileDate = new Date(modifiedDate);
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfYesterday = new Date(
      startOfToday.getTime() - 24 * 60 * 60 * 1000,
    );
    const startOfWeek = new Date(
      startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000,
    );
    const startOfMonth = new Date(
      startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000,
    );
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    switch (filter) {
      case 'today':
        return fileDate >= startOfToday;
      case 'yesterday':
        return fileDate >= startOfYesterday && fileDate < startOfToday;
      case 'week':
        return fileDate >= startOfWeek;
      case 'month':
        return fileDate >= startOfMonth;
      case 'year':
        return fileDate >= startOfYear;
      default:
        return true;
    }
  };

  // Filter files based on search query, tags, and hidden files toggle
  const filteredFiles = files.filter((f) => {
    const {
      textSearch,
      tagFilter: searchTagFilter,
      typeFilter,
      tierFilter,
      extFilter,
      isFilter,
      sizeFilter,
      modifiedFilter,
    } = parseSearchQuery(searchQuery);

    // Filter by text search (name)
    if (
      textSearch &&
      !f.name.toLowerCase().includes(textSearch.toLowerCase())
    ) {
      return false;
    }

    // Filter by tag: operator in search
    if (searchTagFilter) {
      const fileTags = (f.tags || []).map((t) => t.toLowerCase());
      if (!fileTags.some((t) => t.includes(searchTagFilter))) {
        return false;
      }
    }

    // Filter by sidebar tag filter
    if (filterByTag && !(f.tags || []).includes(filterByTag)) {
      return false;
    }

    // Filter by type: operator (video, image, audio, document, folder, archive)
    if (typeFilter) {
      const mimeType = f.mimeType?.toLowerCase() || '';
      const isMatch =
        (typeFilter === 'video' && mimeType.startsWith('video/')) ||
        (typeFilter === 'image' && mimeType.startsWith('image/')) ||
        (typeFilter === 'audio' && mimeType.startsWith('audio/')) ||
        (typeFilter === 'document' &&
          (mimeType.includes('pdf') ||
            mimeType.includes('document') ||
            mimeType.includes('text/'))) ||
        (typeFilter === 'folder' && (mimeType === 'folder' || f.isDirectory)) ||
        (typeFilter === 'archive' &&
          (mimeType.includes('zip') ||
            mimeType.includes('tar') ||
            mimeType.includes('rar') ||
            mimeType.includes('7z') ||
            f.name.match(/\.(zip|tar|gz|rar|7z|bz2)$/i)));
      if (!isMatch) return false;
    }

    // Filter by tier: operator
    if (tierFilter && f.tierStatus?.toLowerCase() !== tierFilter) {
      return false;
    }

    // Filter by ext: operator
    if (extFilter) {
      const fileExt = f.name.split('.').pop()?.toLowerCase();
      if (fileExt !== extFilter) return false;
    }

    // Filter by is: operator (folder, file, hidden, cached, tagged)
    if (isFilter) {
      switch (isFilter) {
        case 'folder':
          if (!f.isDirectory) return false;
          break;
        case 'file':
          if (f.isDirectory) return false;
          break;
        case 'hidden':
          if (!(f.isHidden ?? f.name.startsWith('.'))) return false;
          break;
        case 'cached':
          if (!f.isCached) return false;
          break;
        case 'tagged':
          if (!(f.tags && f.tags.length > 0)) return false;
          break;
      }
    }

    // Filter by size: operator
    if (sizeFilter && !matchesSizeFilter(f.size || 0, sizeFilter)) {
      return false;
    }

    // Filter by modified: operator
    if (
      modifiedFilter &&
      !matchesModifiedFilter(f.lastModified, modifiedFilter)
    ) {
      return false;
    }

    // Filter hidden files unless showHiddenFiles is enabled
    const isHidden = f.isHidden ?? f.name.startsWith('.');
    if (!showHiddenFiles && isHidden) {
      return false;
    }

    return true;
  });

  const selectedFile =
    selectedFiles.size === 1
      ? files.find((f) => f.path === Array.from(selectedFiles)[0])
      : null;

  // Helper to render a storage item in the sidebar
  const renderStorageItem = (source: StorageSource) => {
    const StorageIcon = getStorageIcon(source);
    const isDropTarget = dropTarget === `source:${source.id}`;
    const tierClass = source.tierStatus || 'hot';

    // Determine storage type label
    const getTypeLabel = (cat: string) => {
      switch (cat) {
        case 'local':
          return 'Local';
        case 'network':
          return 'Network';
        case 'cloud':
          return 'Object';
        case 'hybrid':
          return 'Hybrid';
        case 'block':
          return 'Block';
        default:
          return cat;
      }
    };

    return (
      <button
        key={source.id}
        className={`sidebar-item storage-item ${selectedSource?.id === source.id ? 'active' : ''} ${isDropTarget ? 'drop-target' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          selectSource(source);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setStorageContextMenu({
            source,
            x: e.clientX,
            y: e.clientY,
          });
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (dragSourceId !== source.id) {
            setDropTarget(`source:${source.id}`);
          }
        }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={(e) => handleDropOnSource(e, source)}
      >
        <span className="item-icon">
          <StorageIcon size={16} />
        </span>
        <span className="item-name">{source.name}</span>
        <span className="storage-badges">
          {/* Tier indicator */}
          <span
            className={`storage-tier-badge ${tierClass}`}
            title={`${tierClass.charAt(0).toUpperCase() + tierClass.slice(1)} Tier - ${getTypeLabel(source.category)}`}
          >
            {tierClass.charAt(0).toUpperCase()}
          </span>
        </span>
        {source.status !== 'connected' && (
          <span className="offline-dot" title="Disconnected" />
        )}
      </button>
    );
  };

  return (
    <div className="finder">
      {/* Toolbar */}
      <div className="finder-toolbar">
        <div className="toolbar-nav">
          {/* Back button */}
          <button
            className="toolbar-btn nav"
            onClick={goBack}
            disabled={!canGoBack}
            title="Go Back (⌘[)"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          {/* Forward button */}
          <button
            className="toolbar-btn nav"
            onClick={goForward}
            disabled={!canGoForward}
            title="Go Forward (⌘])"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          {/* Up button */}
          <button
            className="toolbar-btn nav"
            onClick={goUp}
            disabled={!canGoUp}
            title="Go Up (⌘↑)"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
        </div>

        <div className="toolbar-center">
          <Breadcrumbs
            items={getBreadcrumbs()}
            onNavigate={navigateTo}
            maxVisible={5}
            showIcons={true}
          />
        </div>

        <div className="toolbar-right">
          <div className="view-switcher">
            <button
              className={`view-btn ${viewMode === 'icon' ? 'active' : ''}`}
              onClick={() => setViewMode('icon')}
              title="Grid View"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <rect x="1" y="1" width="6" height="6" rx="1.5" />
                <rect x="9" y="1" width="6" height="6" rx="1.5" />
                <rect x="1" y="9" width="6" height="6" rx="1.5" />
                <rect x="9" y="9" width="6" height="6" rx="1.5" />
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
                <rect x="1" y="2" width="14" height="2.5" rx="1" />
                <rect x="1" y="6.75" width="14" height="2.5" rx="1" />
                <rect x="1" y="11.5" width="14" height="2.5" rx="1" />
              </svg>
            </button>
          </div>

          <SearchBox
            value={searchQuery}
            onChange={setSearchQuery}
            files={files}
            placeholder="Search files..."
          />

          {/* Toggle hidden files */}
          <button
            className={`toolbar-btn ${showHiddenFiles ? 'active' : ''}`}
            onClick={() => setShowHiddenFiles(!showHiddenFiles)}
            title={showHiddenFiles ? 'Hide Hidden Files' : 'Show Hidden Files'}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              width="20"
              height="20"
            >
              {showHiddenFiles ? (
                // Eye open - visible
                <>
                  <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                  <circle cx="12" cy="12" r="3.5" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" />
                </>
              ) : (
                // Eye closed - hidden
                <>
                  <path d="M2 2l20 20" strokeWidth="2" />
                  <path d="M6.7 6.7C4.2 8.5 2.5 12 2.5 12s3.5 7 9.5 7c2 0 3.8-.6 5.3-1.5" />
                  <path d="M17.3 14.3c1.3-1.2 2.2-2.3 2.2-2.3s-3.5-7-9.5-7c-.7 0-1.4.1-2 .2" />
                  <circle cx="12" cy="12" r="3.5" />
                </>
              )}
            </svg>
          </button>

          {/* Toggle Info Panel */}
          <button
            className={`toolbar-btn ${showInfoPanel ? 'active' : ''}`}
            onClick={() => setShowInfoPanel(!showInfoPanel)}
            title="Toggle Info Panel"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              width="20"
              height="20"
            >
              <rect x="3" y="3" width="18" height="18" rx="2.5" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <circle cx="15" cy="10" r="1.5" fill="currentColor" />
              <line
                x1="15"
                y1="13"
                x2="15"
                y2="17"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="finder-body">
        {/* Sidebar */}
        <aside className="finder-sidebar">
          <div
            className={`sidebar-section favorites-section ${dropTarget === 'favorites' ? 'drop-target' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropTarget('favorites');
              e.dataTransfer.dropEffect = 'link';
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDropTarget(null);
              }
            }}
            onDrop={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropTarget(null);

              // Get the source for the dragged files
              const dropSourceId = dragSourceId || selectedSource?.id;
              const dropSource =
                sources.find((s) => s.id === dropSourceId) || selectedSource;

              // Add dragged files to global favorites using stored file objects
              if (dropSource && draggedFileObjects.length > 0) {
                console.log(
                  '[VFS DnD] Dropping to favorites:',
                  draggedFileObjects.length,
                  'files from',
                  dropSource.name,
                );
                for (const file of draggedFileObjects) {
                  addToGlobalFavorites(file, dropSource);
                }
              } else if (dropSource && draggedFiles.length > 0) {
                // Fallback: try to find files in current directory
                console.log(
                  '[VFS DnD] Fallback: looking for',
                  draggedFiles.length,
                  'files in current directory',
                );
                for (const filePath of draggedFiles) {
                  const file = files.find((f) => f.path === filePath);
                  if (file) {
                    addToGlobalFavorites(file, dropSource);
                  }
                }
              }

              setDraggedFiles([]);
              setDraggedFileObjects([]);
              setDragSourceId(null);
            }}
          >
            <div className="section-header">
              <IconStar size={14} glow={false} />
              <span>Favorites</span>
              {favorites.length > 0 && (
                <span className="section-count">({favorites.length})</span>
              )}
            </div>
            {favorites.length === 0 ? (
              <div className="sidebar-empty">
                <span className="empty-text">Drop files here</span>
                <span className="empty-hint">Drag to add favorites</span>
              </div>
            ) : (
              favorites.slice(0, 10).map((fav) => (
                <button
                  key={fav.id}
                  className="sidebar-item"
                  onClick={() => navigateToFavorite(fav)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeFromGlobalFavorites(fav.id);
                  }}
                  title={`${fav.sourceName}: ${fav.path}\nRight-click to remove`}
                >
                  <span className="item-icon">
                    {fav.isDirectory ? (
                      <IconFolder size={16} />
                    ) : (
                      <IconStar size={16} />
                    )}
                  </span>
                  <span className="item-name">{fav.name}</span>
                </button>
              ))
            )}
            {favorites.length > 10 && (
              <div className="sidebar-item show-more">
                <span className="item-icon">+</span>
                <span>{favorites.length - 10} more</span>
              </div>
            )}
          </div>

          {/* Storage Section - Grouped by type with collapsible submenus */}
          <div className="sidebar-section storage-section">
            <div className="section-header">
              <IconDatabase size={14} glow={false} />
              <span>Storage</span>
              <span className="section-count">({sources.length})</span>
            </div>

            {/* Local Storage - Split into Volumes and Locations */}
            {sources.filter((s) => s.category === 'local').length > 0 && (
              <>
                {/* Mounted Volumes (ejectable) */}
                {sources.filter((s) => s.category === 'local' && s.isEjectable)
                  .length > 0 && (
                  <div
                    className={`storage-group ${collapsedGroups.has('volumes') ? 'collapsed' : ''}`}
                  >
                    <button
                      className="storage-group-header subgroup"
                      onClick={() => toggleGroup('volumes')}
                    >
                      <span className="group-chevron">
                        <svg viewBox="0 0 16 16" fill="currentColor">
                          <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
                        </svg>
                      </span>
                      <span className="group-icon volumes">
                        <svg viewBox="0 0 16 16" fill="currentColor">
                          <path d="M0 1.5A1.5 1.5 0 0 1 1.5 0h13A1.5 1.5 0 0 1 16 1.5v2A1.5 1.5 0 0 1 14.5 5h-13A1.5 1.5 0 0 1 0 3.5v-2zM1.5 1a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5h-13z" />
                          <path d="M2 2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5zm10 0a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0z" />
                        </svg>
                      </span>
                      <span className="group-label">Volumes</span>
                      <span className="group-count">
                        {
                          sources.filter(
                            (s) => s.category === 'local' && s.isEjectable,
                          ).length
                        }
                      </span>
                    </button>
                    <div className="storage-group-items">
                      {sources
                        .filter((s) => s.category === 'local' && s.isEjectable)
                        .map((source) => renderStorageItem(source))}
                    </div>
                  </div>
                )}

                {/* System Locations (non-ejectable) */}
                {sources.filter((s) => s.category === 'local' && !s.isEjectable)
                  .length > 0 && (
                  <div
                    className={`storage-group ${collapsedGroups.has('locations') ? 'collapsed' : ''}`}
                  >
                    <button
                      className="storage-group-header subgroup"
                      onClick={() => toggleGroup('locations')}
                    >
                      <span className="group-chevron">
                        <svg viewBox="0 0 16 16" fill="currentColor">
                          <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
                        </svg>
                      </span>
                      <span className="group-icon locations">
                        <svg viewBox="0 0 16 16" fill="currentColor">
                          <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z" />
                        </svg>
                      </span>
                      <span className="group-label">Locations</span>
                      <span className="group-count">
                        {
                          sources.filter(
                            (s) => s.category === 'local' && !s.isEjectable,
                          ).length
                        }
                      </span>
                    </button>
                    <div className="storage-group-items">
                      {sources
                        .filter((s) => s.category === 'local' && !s.isEjectable)
                        .map((source) => renderStorageItem(source))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Network Storage (NFS, SMB, NAS) */}
            {sources.filter(
              (s) => s.category === 'network' || s.category === 'hybrid',
            ).length > 0 && (
              <div
                className={`storage-group ${collapsedGroups.has('network') ? 'collapsed' : ''}`}
              >
                <button
                  className="storage-group-header"
                  onClick={() => toggleGroup('network')}
                >
                  <span className="group-chevron">
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
                    </svg>
                  </span>
                  <span className="group-icon network">
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M0 8a4 4 0 0 1 4-4h8a4 4 0 0 1 0 8H4a4 4 0 0 1-4-4zm4-3a3 3 0 0 0 0 6h8a3 3 0 0 0 0-6H4z" />
                      <path d="M8 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
                    </svg>
                  </span>
                  <span className="group-label">Network</span>
                  <span className="group-count">
                    {
                      sources.filter(
                        (s) =>
                          s.category === 'network' || s.category === 'hybrid',
                      ).length
                    }
                  </span>
                </button>
                <div className="storage-group-items">
                  {sources
                    .filter(
                      (s) =>
                        s.category === 'network' || s.category === 'hybrid',
                    )
                    .map((source) => renderStorageItem(source))}
                </div>
              </div>
            )}

            {/* Object Storage (S3, GCS, Azure) */}
            {sources.filter((s) => s.category === 'cloud').length > 0 && (
              <div
                className={`storage-group ${collapsedGroups.has('cloud') ? 'collapsed' : ''}`}
              >
                <button
                  className="storage-group-header"
                  onClick={() => toggleGroup('cloud')}
                >
                  <span className="group-chevron">
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
                    </svg>
                  </span>
                  <span className="group-icon cloud">
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z" />
                    </svg>
                  </span>
                  <span className="group-label">Cloud</span>
                  <span className="group-count">
                    {sources.filter((s) => s.category === 'cloud').length}
                  </span>
                </button>
                <div className="storage-group-items">
                  {sources
                    .filter((s) => s.category === 'cloud')
                    .map((source) => renderStorageItem(source))}
                </div>
              </div>
            )}

            {/* Block Storage */}
            {sources.filter((s) => s.category === 'block').length > 0 && (
              <div
                className={`storage-group ${collapsedGroups.has('block') ? 'collapsed' : ''}`}
              >
                <button
                  className="storage-group-header"
                  onClick={() => toggleGroup('block')}
                >
                  <span className="group-chevron">
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
                    </svg>
                  </span>
                  <span className="group-icon block">
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M0 1.5A1.5 1.5 0 0 1 1.5 0h13A1.5 1.5 0 0 1 16 1.5v2A1.5 1.5 0 0 1 14.5 5h-13A1.5 1.5 0 0 1 0 3.5v-2zM1.5 1a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5h-13z" />
                      <path d="M0 6.5A1.5 1.5 0 0 1 1.5 5h13A1.5 1.5 0 0 1 16 6.5v2A1.5 1.5 0 0 1 14.5 10h-13A1.5 1.5 0 0 1 0 8.5v-2z" />
                    </svg>
                  </span>
                  <span className="group-label">Block</span>
                  <span className="group-count">
                    {sources.filter((s) => s.category === 'block').length}
                  </span>
                </button>
                <div className="storage-group-items">
                  {sources
                    .filter((s) => s.category === 'block')
                    .map((source) => renderStorageItem(source))}
                </div>
              </div>
            )}

            {sources.length === 0 && (
              <div className="sidebar-empty">
                <span className="empty-text">No storage connected</span>
              </div>
            )}
          </div>

          {/* Add Storage Button */}
          <div className="sidebar-section">
            <button
              className="add-storage-btn"
              onClick={() => setShowAddStorage(true)}
              title="Add Storage"
            >
              <span className="add-icon">+</span>
              <span>Add Storage</span>
            </button>
          </div>

          {/* Tags Section - Using same list design as Storage */}
          <div className="sidebar-section storage-section">
            <div className="section-header">
              <IconTag size={14} glow={false} />
              <span>Tags</span>
              {allTags.length > 0 && (
                <span className="section-count">({allTags.length})</span>
              )}
            </div>
            {filterByTag && (
              <div className="storage-group-items">
                <button
                  className="sidebar-item storage-item active filter-active"
                  onClick={() => setFilterByTag(null)}
                >
                  <span className="item-icon">
                    <span
                      className="tag-dot"
                      style={{
                        background:
                          allTags.find((t) => t.name === filterByTag)?.color ||
                          'var(--vfs-primary)',
                      }}
                    />
                  </span>
                  <span className="item-name">{filterByTag}</span>
                  <span className="clear-filter">✕</span>
                </button>
              </div>
            )}
            {allTags.length === 0 ? (
              <div className="sidebar-empty">
                <span className="empty-text">No tags yet</span>
              </div>
            ) : (
              <div className="storage-group-items">
                {allTags
                  .filter((t) => t.name !== filterByTag)
                  .slice(0, 8)
                  .map((tag) => (
                    <button
                      key={tag.name}
                      className={`sidebar-item storage-item ${filterByTag === tag.name ? 'active' : ''}`}
                      onClick={() => setFilterByTag(tag.name)}
                    >
                      <span className="item-icon">
                        <span
                          className="tag-dot"
                          style={{
                            background: tag.color || 'var(--vfs-primary)',
                          }}
                        />
                      </span>
                      <span className="item-name">{tag.name}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Metrics Preview */}
          {onOpenMetrics && <MetricsPreview onOpenMetrics={onOpenMetrics} />}
        </aside>

        {/* Main Content */}
        <main
          className="finder-content file-browser"
          onContextMenu={(e) => handleContextMenu(e)}
          onDragOver={(e) => handleDragOver(e)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, currentPath)}
        >
          {loading ? (
            <div className="empty-state">
              <div className="spinner" />
              <span className="empty-state-text">Loading...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="empty-state">
              <IconFolder
                size={48}
                color="var(--finder-text-quaternary)"
                glow={false}
              />
              <span className="empty-state-text">No files</span>
              <span className="empty-state-hint">
                Right-click to create or paste
              </span>
            </div>
          ) : (
            <>
              {viewMode === 'icon' && (
                <div
                  className={`icon-view ${isDraggingOver && dropTarget === null ? 'drop-zone-active' : ''}`}
                  onContextMenu={(e) => handleContextMenu(e)}
                  onDragOver={(e) => handleDragOver(e)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, currentPath)}
                >
                  {filteredFiles.map((file, index) => {
                    const isFolder =
                      file.mimeType === 'folder' || file.path.endsWith('/');
                    const isDropTarget = isFolder && dropTarget === file.path;
                    const isDragging = draggedFiles.includes(file.path);
                    const fileIsHidden =
                      file.isHidden ?? file.name.startsWith('.');
                    return (
                      <div
                        key={file.path}
                        data-path={file.path}
                        className={`file-item ${selectedFiles.has(file.path) ? 'selected' : ''} ${isFolder ? 'folder' : ''} ${isDropTarget ? 'drop-target' : ''} ${isDragging ? 'dragging' : ''} ${fileIsHidden ? 'is-hidden' : ''}`}
                        onClick={(e) => handleFileClick(file, e)}
                        onDoubleClick={() => handleFileDoubleClick(file)}
                        onContextMenu={(e) => handleContextMenu(e, file)}
                        data-type={isFolder ? 'folder' : 'file'}
                        tabIndex={0}
                        // Drag and drop
                        draggable
                        onDragStart={(e) => handleDragStart(e, file)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) =>
                          handleDragOver(e, file.path, isFolder)
                        }
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => {
                          if (isFolder) {
                            handleDrop(e, file.path);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFileDoubleClick(file);
                          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                            e.preventDefault();
                            const nextEl = e.currentTarget
                              .nextElementSibling as HTMLElement;
                            if (nextEl) {
                              nextEl.focus();
                              const next = filteredFiles[index + 1];
                              if (next) setSelectedFiles(new Set([next.path]));
                            }
                          }
                          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                            e.preventDefault();
                            const prevEl = e.currentTarget
                              .previousElementSibling as HTMLElement;
                            if (prevEl) {
                              prevEl.focus();
                              const prev = filteredFiles[index - 1];
                              if (prev) setSelectedFiles(new Set([prev.path]));
                            }
                          }
                        }}
                      >
                        <div className="file-icon">
                          {file.thumbnail ? (
                            <img src={file.thumbnail} alt="" />
                          ) : (
                            <span className="icon-placeholder">
                              {getFileIcon(file, 48)}
                            </span>
                          )}
                          {getTierIndicator(file, warmProgress[file.path])}
                          <span
                            className={`grid-tier-badge ${file.tierStatus || 'hot'}`}
                            title={`Storage: ${file.tierStatus || 'Hot'}`}
                          >
                            {file.tierStatus || 'hot'}
                          </span>
                        </div>
                        <div className="file-name" title={file.name}>
                          {renamingFile === file.path ? (
                            <input
                              ref={renameInputRef}
                              type="text"
                              className="rename-input"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={handleRenameKeyDown}
                              onBlur={commitRename}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            truncateMiddle(file.name, 28)
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {viewMode === 'list' && (
                <div
                  className={`list-view ${isDraggingOver && dropTarget === null ? 'drop-zone-active' : ''}`}
                  onContextMenu={(e) => handleContextMenu(e)}
                  onDragOver={(e) => handleDragOver(e)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, currentPath)}
                >
                  <div className="list-header">
                    <div className="col-name">Name</div>
                    <div className="col-date">Date Modified</div>
                    <div className="col-size">Size</div>
                    <div className="col-tier">Tier</div>
                  </div>
                  <div className="list-body">
                    {filteredFiles.map((file, index) => {
                      const isFolder =
                        file.mimeType === 'folder' || file.path.endsWith('/');
                      const isDropTarget = isFolder && dropTarget === file.path;
                      const isDragging = draggedFiles.includes(file.path);
                      const fileIsHidden =
                        file.isHidden ?? file.name.startsWith('.');
                      return (
                        <div
                          key={file.path}
                          data-path={file.path}
                          className={`list-row ${selectedFiles.has(file.path) ? 'selected' : ''} ${isFolder ? 'folder' : ''} ${isDropTarget ? 'drop-target' : ''} ${isDragging ? 'dragging' : ''} ${fileIsHidden ? 'is-hidden' : ''}`}
                          onClick={(e) => handleFileClick(file, e)}
                          onDoubleClick={() => handleFileDoubleClick(file)}
                          onContextMenu={(e) => handleContextMenu(e, file)}
                          data-type={isFolder ? 'folder' : 'file'}
                          tabIndex={0}
                          draggable
                          onDragStart={(e) => handleDragStart(e, file)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) =>
                            handleDragOver(e, file.path, isFolder)
                          }
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => {
                            if (isFolder) {
                              handleDrop(e, file.path);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleFileDoubleClick(file);
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              const nextEl = e.currentTarget
                                .nextElementSibling as HTMLElement;
                              if (nextEl) {
                                nextEl.focus();
                                const next = filteredFiles[index + 1];
                                if (next)
                                  setSelectedFiles(new Set([next.path]));
                              }
                            }
                            if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              const prevEl = e.currentTarget
                                .previousElementSibling as HTMLElement;
                              if (prevEl) {
                                prevEl.focus();
                                const prev = filteredFiles[index - 1];
                                if (prev)
                                  setSelectedFiles(new Set([prev.path]));
                              }
                            }
                          }}
                        >
                          <div className="col-name" title={file.name}>
                            <span className="row-icon">
                              {getFileIcon(file, 18)}
                            </span>
                            {renamingFile === file.path ? (
                              <input
                                ref={renameInputRef}
                                type="text"
                                className="rename-input"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={handleRenameKeyDown}
                                onBlur={commitRename}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              file.name
                            )}
                          </div>
                          <div className="col-date">
                            {new Date(file.lastModified).toLocaleDateString()}
                          </div>
                          <div className="col-size">
                            {formatSize(file.size)}
                          </div>
                          <div className="col-tier">
                            {getTierBadge(file, warmProgress[file.path])}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* Info Panel */}
        {showInfoPanel && (
          <aside className="finder-info">
            {selectedFile ? (
              <>
                <div className="info-preview">
                  {selectedFile.thumbnail ? (
                    <img src={selectedFile.thumbnail} alt="" />
                  ) : (
                    <span className="info-icon">
                      {getFileIcon(selectedFile, 64)}
                    </span>
                  )}
                </div>
                <h3 className="info-name">{selectedFile.name}</h3>
                <div className="info-meta">
                  {/* Basic Info */}
                  <div className="meta-section">
                    <div className="meta-section-title">General</div>
                    <div className="meta-row">
                      <span className="meta-label">Size</span>
                      <span className="meta-value">
                        {formatSize(selectedFile.size)}
                      </span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Modified</span>
                      <span className="meta-value">
                        {new Date(selectedFile.lastModified).toLocaleString()}
                      </span>
                    </div>
                    {selectedFile.createdAt && (
                      <div className="meta-row">
                        <span className="meta-label">Created</span>
                        <span className="meta-value">
                          {new Date(selectedFile.createdAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="meta-row">
                      <span className="meta-label">Tier</span>
                      <span className="meta-value">
                        {getTierBadge(
                          selectedFile,
                          warmProgress[selectedFile.path],
                        )}
                      </span>
                    </div>
                    {selectedFile.container && (
                      <div className="meta-row">
                        <span className="meta-label">Container</span>
                        <span className="meta-value">
                          {selectedFile.container.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Video Info */}
                  {(selectedFile.videoCodec || selectedFile.width) && (
                    <div className="meta-section">
                      <div className="meta-section-title">Video</div>
                      {selectedFile.width && selectedFile.height && (
                        <div className="meta-row">
                          <span className="meta-label">Resolution</span>
                          <span className="meta-value">
                            {selectedFile.width} x {selectedFile.height}
                          </span>
                        </div>
                      )}
                      {selectedFile.videoCodec && (
                        <div className="meta-row">
                          <span className="meta-label">Codec</span>
                          <span className="meta-value">
                            {selectedFile.videoCodec.toUpperCase()}
                          </span>
                        </div>
                      )}
                      {selectedFile.frameRate && (
                        <div className="meta-row">
                          <span className="meta-label">Frame Rate</span>
                          <span className="meta-value">
                            {selectedFile.frameRate} fps
                          </span>
                        </div>
                      )}
                      {selectedFile.videoBitrate && (
                        <div className="meta-row">
                          <span className="meta-label">Bitrate</span>
                          <span className="meta-value">
                            {selectedFile.videoBitrate} kbps
                          </span>
                        </div>
                      )}
                      {selectedFile.colorSpace && (
                        <div className="meta-row">
                          <span className="meta-label">Color</span>
                          <span className="meta-value">
                            {selectedFile.colorSpace}
                          </span>
                        </div>
                      )}
                      {selectedFile.hdrFormat && (
                        <div className="meta-row">
                          <span className="meta-label">HDR</span>
                          <span className="meta-value highlight">
                            {selectedFile.hdrFormat.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Audio Info */}
                  {(selectedFile.audioCodec || selectedFile.audioChannels) && (
                    <div className="meta-section">
                      <div className="meta-section-title">Audio</div>
                      {selectedFile.audioCodec && (
                        <div className="meta-row">
                          <span className="meta-label">Codec</span>
                          <span className="meta-value">
                            {selectedFile.audioCodec.toUpperCase()}
                          </span>
                        </div>
                      )}
                      {selectedFile.audioChannels && (
                        <div className="meta-row">
                          <span className="meta-label">Channels</span>
                          <span className="meta-value">
                            {selectedFile.audioChannels === 1
                              ? 'Mono'
                              : selectedFile.audioChannels === 2
                                ? 'Stereo'
                                : selectedFile.audioChannels === 6
                                  ? '5.1 Surround'
                                  : selectedFile.audioChannels === 8
                                    ? '7.1 Surround'
                                    : `${selectedFile.audioChannels} ch`}
                          </span>
                        </div>
                      )}
                      {selectedFile.audioSampleRate && (
                        <div className="meta-row">
                          <span className="meta-label">Sample Rate</span>
                          <span className="meta-value">
                            {selectedFile.audioSampleRate / 1000} kHz
                          </span>
                        </div>
                      )}
                      {selectedFile.audioBitrate && (
                        <div className="meta-row">
                          <span className="meta-label">Bitrate</span>
                          <span className="meta-value">
                            {selectedFile.audioBitrate} kbps
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Duration */}
                  {selectedFile.duration && (
                    <div className="meta-section">
                      <div className="meta-section-title">Duration</div>
                      <div className="meta-row">
                        <span className="meta-label">Length</span>
                        <span className="meta-value highlight">
                          {Math.floor(selectedFile.duration / 3600) > 0
                            ? `${Math.floor(selectedFile.duration / 3600)}h ${Math.floor((selectedFile.duration % 3600) / 60)}m ${Math.floor(selectedFile.duration % 60)}s`
                            : `${Math.floor(selectedFile.duration / 60)}m ${Math.floor(selectedFile.duration % 60)}s`}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {selectedFile.tags && selectedFile.tags.length > 0 && (
                    <div className="meta-section">
                      <div className="meta-section-title">Tags</div>
                      <div className="meta-tags">
                        {selectedFile.tags.map((tag, i) => (
                          <span key={i} className="meta-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="info-actions">
                  {/* Warm to Hot - only for cloud/remote storage */}
                  {!isMountedStorage() &&
                    selectedFile.canWarm &&
                    !selectedFile.isWarmed && (
                      <button
                        className="action-btn warm"
                        onClick={() => handleWarm(selectedFile)}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 23a7.5 7.5 0 0 1-5.138-12.963C8.204 8.774 11.5 6.5 11 1.5c0 0 6.5 3.5 6.5 9a5.5 5.5 0 0 1-3 4.9v.1a5 5 0 0 0 5 5c0 3.866-3.134 2.5-7.5 2.5z" />
                        </svg>
                        Warm to Hot
                      </button>
                    )}
                  {/* Transcode - only for cloud/remote storage */}
                  {!isMountedStorage() && selectedFile.canTranscode && (
                    <button
                      className="action-btn secondary"
                      onClick={() => handleTranscode(selectedFile)}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Transcode
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="info-empty">
                <div className="info-empty-icon">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                </div>
                <p>No selection</p>
                <p className="info-hint">{files.length} items</p>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Status Bar */}
      <div className="finder-statusbar">
        <span>
          {filteredFiles.length} items
          {selectedFiles.size > 0 && ` · ${selectedFiles.size} selected`}
          {showHiddenFiles && ` · Hidden files visible`}
        </span>
        {selectedSource && (
          <span className="statusbar-source">{selectedSource.name}</span>
        )}
      </div>

      {/* Context Menu - Minimal Native-like Menu */}
      {contextMenu.visible && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Open action for file/folder */}
          {contextMenu.targetFile && (
            <>
              <button
                className="context-item"
                onClick={() => {
                  if (contextMenu.targetFile) {
                    if (
                      contextMenu.targetFile.mimeType === 'folder' ||
                      contextMenu.targetFile.path.endsWith('/')
                    ) {
                      navigateTo(contextMenu.targetFile.path);
                    } else {
                      handleOpenFile(contextMenu.targetFile);
                    }
                  }
                  closeContextMenu();
                }}
              >
                <svg
                  className="context-icon"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.172a1.5 1.5 0 0 1 1.06.44l.708.706a.5.5 0 0 0 .354.147H13.5A1.5 1.5 0 0 1 15 4.793v7.707A1.5 1.5 0 0 1 13.5 14h-11A1.5 1.5 0 0 1 1 12.5v-9z" />
                </svg>
                Open
              </button>

              {/* Open With submenu - only for files, not folders */}
              {contextMenu.targetFile &&
                !(
                  contextMenu.targetFile.mimeType === 'folder' ||
                  contextMenu.targetFile.path.endsWith('/')
                ) && (
                  <div
                    className="context-item has-submenu"
                    onMouseEnter={() => {
                      if (contextMenu.targetFile) {
                        loadAppsForFile(contextMenu.targetFile);
                        setShowOpenWith(true);
                      }
                    }}
                    onMouseLeave={() => setShowOpenWith(false)}
                  >
                    <svg
                      className="context-icon"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M6.5 1A1.5 1.5 0 0 0 5 2.5V3H1.5A1.5 1.5 0 0 0 0 4.5v8A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 14.5 3H11v-.5A1.5 1.5 0 0 0 9.5 1h-3zm0 1h3a.5.5 0 0 1 .5.5V3H6v-.5a.5.5 0 0 1 .5-.5z" />
                    </svg>
                    Open With
                    <svg
                      className="context-arrow"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M6 12.796V3.204L11.481 8 6 12.796z" />
                    </svg>
                    {/* Open With submenu */}
                    {showOpenWith && (
                      <div className="context-submenu">
                        {appsLoading ? (
                          <div className="context-item disabled">
                            Loading apps...
                          </div>
                        ) : availableApps.length > 0 ? (
                          availableApps.map((app, index) => (
                            <button
                              key={index}
                              className="context-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (contextMenu.targetFile) {
                                  handleOpenFileWith(
                                    contextMenu.targetFile,
                                    app.path,
                                  );
                                }
                                closeContextMenu();
                              }}
                            >
                              {app.name}
                            </button>
                          ))
                        ) : (
                          <div className="context-item disabled">
                            No apps found
                          </div>
                        )}
                        <div className="context-divider" />
                        <button
                          className="context-item"
                          onClick={async (e) => {
                            e.stopPropagation();
                            // Don't close menu immediately - wait for user selection
                            if (contextMenu.targetFile) {
                              try {
                                const { open } =
                                  await import('@tauri-apps/plugin-dialog');

                                // Close the context menu before opening dialog
                                closeContextMenu();

                                // Open file picker to choose an application
                                const selectedApp = await open({
                                  title: 'Choose Application',
                                  directory: false,
                                  multiple: false,
                                  filters: navigator.platform.includes('Mac')
                                    ? [
                                        {
                                          name: 'Applications',
                                          extensions: ['app'],
                                        },
                                      ]
                                    : navigator.platform.includes('Win')
                                      ? [
                                          {
                                            name: 'Executables',
                                            extensions: ['exe'],
                                          },
                                        ]
                                      : [],
                                  defaultPath: navigator.platform.includes(
                                    'Mac',
                                  )
                                    ? '/Applications'
                                    : navigator.platform.includes('Win')
                                      ? 'C:\\Program Files'
                                      : '/usr/bin',
                                });

                                // Handle different return types from dialog
                                let appPath: string | null = null;

                                if (selectedApp === null) {
                                  // User cancelled
                                  return;
                                } else if (typeof selectedApp === 'string') {
                                  appPath = selectedApp;
                                } else if (Array.isArray(selectedApp)) {
                                  // Dialog might return an array (even with multiple: false)
                                  const firstItem = selectedApp[0];
                                  if (
                                    typeof firstItem === 'string' &&
                                    firstItem
                                  ) {
                                    appPath = firstItem;
                                  }
                                }

                                if (appPath) {
                                  await handleOpenFileWith(
                                    contextMenu.targetFile,
                                    appPath,
                                  );
                                }
                              } catch (err) {
                                console.error(
                                  'Failed to open app picker:',
                                  err,
                                );
                                DialogService.error(
                                  `Failed to open application picker: ${err}`,
                                  'Open With Error',
                                );
                              }
                            } else {
                              closeContextMenu();
                            }
                          }}
                        >
                          Other...
                        </button>
                      </div>
                    )}
                  </div>
                )}

              {/* Asset Details - Get Info */}
              {contextMenu.targetFile && (
                <>
                  <div className="context-divider" />
                  <button
                    className="context-item"
                    onClick={() => {
                      if (contextMenu.targetFile) {
                        setInfoModal({
                          visible: true,
                          file: contextMenu.targetFile,
                        });
                      }
                      closeContextMenu();
                    }}
                  >
                    <svg
                      className="context-icon"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                      <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                    </svg>
                    Asset Details
                    <span className="context-shortcut">⌘I</span>
                  </button>
                </>
              )}

              {/* Move to Storage Tier - Available for files and folders */}
              {contextMenu.targetFile && (
                <>
                  <div className="context-divider" />
                  <button
                    className="context-item"
                    onClick={() => {
                      toast.showToast({
                        type: 'info',
                        message:
                          'Move to Storage Tier: This feature is under development and will be available soon.',
                        duration: 4000,
                      });
                      closeContextMenu();
                    }}
                  >
                    <svg
                      className="context-icon storage-tier"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M.5 3l.04.87a1.99 1.99 0 0 0-.342 1.311l.637 7A2 2 0 0 0 2.826 14H9.81a2 2 0 0 0 1.991-1.819l.637-7a1.99 1.99 0 0 0-.342-1.311L12.5 3H.5zm.217 1h11.566l-.166 2.894a.5.5 0 0 1-.421.45l-5.5.894a.5.5 0 0 1-.578-.45L1.717 4zM14 2H2a1 1 0 0 0-1 1v1h14V3a1 1 0 0 0-1-1zM2 1a2 2 0 0 0-2 2v1h16V3a2 2 0 0 0-2-2H2z" />
                      <path d="M3 4.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-6a.5.5 0 0 1-.5-.5v-1z" />
                    </svg>
                    Move to Storage Tier
                  </button>
                </>
              )}

              <div className="context-divider" />
            </>
          )}

          {/* Clipboard actions */}
          {selectedFiles.size > 0 && (
            <>
              <button
                className="context-item"
                onClick={() => {
                  handleCopy();
                  closeContextMenu();
                }}
              >
                <svg
                  className="context-icon"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6z" />
                  <path d="M2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z" />
                </svg>
                Copy
                <span className="context-shortcut">⌘C</span>
              </button>
            </>
          )}

          <button
            className={`context-item ${!(clipboardHasFiles || nativeClipboardCount > 0) ? 'disabled' : ''}`}
            onClick={() => {
              if (clipboardHasFiles || nativeClipboardCount > 0) {
                // If right-clicking on a folder, paste into it; otherwise paste into current directory
                const isTargetFolder =
                  contextMenu.targetFile &&
                  (contextMenu.targetFile.mimeType === 'folder' ||
                    contextMenu.targetFile.isDirectory);
                handlePaste(
                  isTargetFolder ? contextMenu.targetFile?.path : undefined,
                );
              }
              closeContextMenu();
            }}
            disabled={!(clipboardHasFiles || nativeClipboardCount > 0)}
          >
            <svg
              className="context-icon"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M13 0H6a2 2 0 0 0-2 2 2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2 2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm0 13V4a2 2 0 0 0-2-2H5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1zM3 4a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4z" />
            </svg>
            {nativeClipboardCount > 0
              ? `Paste ${nativeClipboardCount} items`
              : 'Paste'}
            <span className="context-shortcut">⌘V</span>
          </button>

          {selectedFiles.size > 0 && (
            <>
              <div className="context-divider" />

              {selectedFiles.size === 1 && contextMenu.targetFile && (
                <>
                  <button
                    className="context-item"
                    onClick={() => {
                      if (contextMenu.targetFile)
                        handleRename(contextMenu.targetFile);
                      closeContextMenu();
                    }}
                  >
                    <svg
                      className="context-icon"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5z" />
                    </svg>
                    Rename
                  </button>
                  <button
                    className="context-item"
                    onClick={() => {
                      if (contextMenu.targetFile)
                        handleDuplicate(contextMenu.targetFile);
                      closeContextMenu();
                    }}
                  >
                    <svg
                      className="context-icon"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                      <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H4zm0 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" />
                    </svg>
                    Duplicate
                  </button>
                </>
              )}

              <div className="context-divider" />

              <button
                className="context-item danger"
                onClick={() => {
                  handleDelete();
                  closeContextMenu();
                }}
              >
                <svg
                  className="context-icon"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                  <path
                    fillRule="evenodd"
                    d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                  />
                </svg>
                Move to Trash
              </button>
            </>
          )}

          {/* New Folder - only on empty space, not when right-clicking on a folder */}
          {!contextMenu.targetFile && (
            <>
              <div className="context-divider" />
              <button
                className="context-item"
                onClick={() => {
                  // Create folder in current directory
                  handleNewFolder();
                  closeContextMenu();
                }}
              >
                <svg
                  className="context-icon"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="m.5 3 .04.87a1.99 1.99 0 0 0-.342 1.311l.637 7A2 2 0 0 0 2.826 14H9v-1H2.826a1 1 0 0 1-.995-.91l-.637-7A1 1 0 0 1 2.19 4h11.62a1 1 0 0 1 .996 1.09L14.54 8h1.005l.256-2.819A2 2 0 0 0 13.81 3H9.828a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 6.172 1H2.5a2 2 0 0 0-2 2zm5.672-1a1 1 0 0 1 .707.293L7.586 3H2.19c-.24 0-.47.042-.683.12L1.5 2.98a1 1 0 0 1 1-.98h3.672z" />
                  <path d="M13.5 10a.5.5 0 0 1 .5.5V12h1.5a.5.5 0 0 1 0 1H14v1.5a.5.5 0 0 1-1 0V13h-1.5a.5.5 0 0 1 0-1H13v-1.5a.5.5 0 0 1 .5-.5z" />
                </svg>
                New Folder
                <span className="context-shortcut">⌘⇧N</span>
              </button>
            </>
          )}

          {/* Tier actions - only for cloud/remote storage with cold/archive files */}
          {!isMountedStorage() &&
            contextMenu.targetFile &&
            (contextMenu.targetFile.tierStatus === 'cold' ||
              contextMenu.targetFile.tierStatus === 'nearline' ||
              contextMenu.targetFile.tierStatus === 'archive' ||
              (contextMenu.targetFile.canWarm &&
                !contextMenu.targetFile.isWarmed)) && (
              <>
                <div className="context-divider" />
                <button
                  className="context-item"
                  onClick={async () => {
                    if (!selectedSource || !contextMenu.targetFile) {
                      closeContextMenu();
                      return;
                    }

                    try {
                      const { invoke } = await import('@tauri-apps/api/core');
                      await invoke('vfs_change_tier', {
                        sourceId: selectedSource.id,
                        paths: [contextMenu.targetFile.path],
                        targetTier: 'hot',
                      });

                      // Refresh the file list
                      await loadFilesList(selectedSource.id, currentPath);
                    } catch (err) {
                      console.error('Hydration failed:', err);
                      DialogService.error(
                        `Failed to fetch file: ${err}`,
                        'Fetch Error',
                      );
                    }
                    closeContextMenu();
                  }}
                >
                  <svg
                    className="context-icon"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                    <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
                  </svg>
                  Make Available Offline
                </button>
              </>
            )}
        </div>
      )}

      {/* Storage Context Menu - macOS Get Info style */}
      {storageContextMenu && (
        <div
          className="storage-info-popover"
          style={{
            position: 'fixed',
            left: storageContextMenu.x,
            top: storageContextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with icon and name */}
          <div className="storage-info-hero">
            <div
              className={`storage-info-icon ${storageContextMenu.source.category}`}
            >
              {storageContextMenu.source.category === 'local' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="4" y="2" width="16" height="20" rx="2" />
                  <line x1="8" y1="6" x2="16" y2="6" />
                  <line x1="8" y1="10" x2="16" y2="10" />
                  <circle cx="12" cy="17" r="2" />
                </svg>
              )}
              {storageContextMenu.source.category === 'network' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              )}
              {storageContextMenu.source.category === 'cloud' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                </svg>
              )}
              {(storageContextMenu.source.category === 'block' ||
                storageContextMenu.source.category === 'hybrid') && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="2" y="4" width="20" height="6" rx="1" />
                  <rect x="2" y="14" width="20" height="6" rx="1" />
                  <circle cx="6" cy="7" r="1" fill="currentColor" />
                  <circle cx="6" cy="17" r="1" fill="currentColor" />
                </svg>
              )}
            </div>
            <div className="storage-info-title-area">
              <h3 className="storage-info-name">
                {storageContextMenu.source.name}
              </h3>
              <span
                className={`storage-info-status ${storageContextMenu.source.status}`}
              >
                <span className="status-indicator" />
                {storageContextMenu.source.status === 'connected'
                  ? 'Connected'
                  : 'Offline'}
              </span>
            </div>
          </div>

          {/* Info Grid */}
          <div className="storage-info-grid">
            <div className="info-row">
              <span className="info-icon">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M14.5 3a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h13zm-13-1A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13z" />
                  <path d="M3 5.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 8a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 8zm0 2.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z" />
                </svg>
              </span>
              <span className="info-label">Kind</span>
              <span className="info-value">
                {storageContextMenu.source.category === 'local'
                  ? 'Local Volume'
                  : storageContextMenu.source.category === 'cloud'
                    ? 'Cloud Storage'
                    : storageContextMenu.source.category === 'network'
                      ? 'Network Volume'
                      : storageContextMenu.source.category === 'block'
                        ? 'Block Storage'
                        : 'Hybrid Volume'}
              </span>
            </div>

            <div className="info-row">
              <span className="info-icon">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                  <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                </svg>
              </span>
              <span className="info-label">Tier</span>
              <span
                className={`info-value tier-pill ${storageContextMenu.source.tierStatus || 'hot'}`}
              >
                {(storageContextMenu.source.tierStatus || 'hot')
                  .charAt(0)
                  .toUpperCase() +
                  (storageContextMenu.source.tierStatus || 'hot').slice(1)}
              </span>
            </div>

            {storageContextMenu.source.path && (
              <div className="info-row path-row">
                <span className="info-icon">
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM2 2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H2z" />
                    <path d="M2.5 4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V4z" />
                  </svg>
                </span>
                <span className="info-label">Path</span>
                <span className="info-value path-value">
                  {storageContextMenu.source.path}
                </span>
              </div>
            )}

            {storageContextMenu.source.providerId && (
              <div className="info-row">
                <span className="info-icon">
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1 0a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5v-1H1V1h5V0H1zm9 0v1h5v14h-5v1h5a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1h-5zM8 7a.5.5 0 0 0 0 1h3.793l-1.147 1.146a.5.5 0 0 0 .708.708l2-2a.5.5 0 0 0 0-.708l-2-2a.5.5 0 1 0-.708.708L11.793 7H8z" />
                  </svg>
                </span>
                <span className="info-label">Provider</span>
                <span className="info-value">
                  {storageContextMenu.source.providerId.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="storage-info-actions">
            <button
              className="storage-action-btn primary"
              onClick={() => {
                selectSource(storageContextMenu.source);
                setStorageContextMenu(null);
              }}
            >
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z" />
              </svg>
              Open
            </button>
            <button
              className="storage-action-btn"
              onClick={() => {
                if (storageContextMenu.source.path) {
                  navigator.clipboard.writeText(storageContextMenu.source.path);
                  toast.showToast({
                    type: 'success',
                    message: 'Path copied to clipboard',
                  });
                }
                setStorageContextMenu(null);
              }}
            >
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
                <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z" />
              </svg>
              Copy Path
            </button>
            {storageContextMenu.source.isEjectable && (
              <button
                className="storage-action-btn eject"
                onClick={async () => {
                  const source = storageContextMenu.source;
                  setStorageContextMenu(null);

                  try {
                    await StorageService.ejectSource(source.id);
                    toast.showToast({
                      type: 'success',
                      message: `Ejected ${source.name}`,
                    });
                    // Refresh sources list
                    await loadSourcesList();
                    // If the ejected source was selected, clear selection
                    if (selectedSource?.id === source.id) {
                      setSelectedSource(null);
                      setFiles([]);
                      setCurrentPath('');
                    }
                  } catch (err) {
                    toast.showToast({
                      type: 'error',
                      message: `Failed to eject: ${err}`,
                    });
                  }
                }}
              >
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M7.27 1.047a1 1 0 0 1 1.46 0l6.345 6.77c.6.638.146 1.683-.73 1.683H11.5v3a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-3H1.654C.78 9.5.326 8.455.924 7.816L7.27 1.047z" />
                </svg>
                Eject
              </button>
            )}
          </div>
        </div>
      )}

      {/* Info Modal */}
      {infoModal.visible && infoModal.file && (
        <InfoModal
          file={infoModal.file}
          sourceId={selectedSource?.id}
          onClose={() => setInfoModal({ visible: false, file: null })}
          onToggleFavorite={(file) => handleToggleFavorite(file.path)}
          isFavorite={isFileFavorite(infoModal.file.path)}
          onAddTag={(file, tag) => {
            // Update file tags
            setFiles((prev) =>
              prev.map((f) =>
                f.id === file.id ? { ...f, tags: [...(f.tags || []), tag] } : f,
              ),
            );
            // Update modal file
            setInfoModal((prev) =>
              prev.file
                ? {
                    ...prev,
                    file: {
                      ...prev.file,
                      tags: [...(prev.file.tags || []), tag],
                    },
                  }
                : prev,
            );
            // Add to global tags if new
            if (!allTags.some((t) => t.name === tag)) {
              setAllTags((prev) => [...prev, { name: tag }]);
            }
          }}
          onRemoveTag={(file, tag) => {
            // Update file tags
            setFiles((prev) =>
              prev.map((f) =>
                f.id === file.id
                  ? { ...f, tags: (f.tags || []).filter((t) => t !== tag) }
                  : f,
              ),
            );
            // Update modal file
            setInfoModal((prev) =>
              prev.file
                ? {
                    ...prev,
                    file: {
                      ...prev.file,
                      tags: (prev.file.tags || []).filter((t) => t !== tag),
                    },
                  }
                : prev,
            );
          }}
          onSetColorLabel={(file, color) => {
            // Update file color label
            setFiles((prev) =>
              prev.map((f) =>
                f.id === file.id ? { ...f, colorLabel: color || undefined } : f,
              ),
            );
            // Update modal file
            setInfoModal((prev) =>
              prev.file
                ? {
                    ...prev,
                    file: { ...prev.file, colorLabel: color || undefined },
                  }
                : prev,
            );
          }}
          onUpdateComments={(file, comments) => {
            // Update file comments
            setFiles((prev) =>
              prev.map((f) => (f.id === file.id ? { ...f, comments } : f)),
            );
            // Update modal file
            setInfoModal((prev) =>
              prev.file ? { ...prev, file: { ...prev.file, comments } } : prev,
            );
          }}
        />
      )}

      {/* Add Storage Modal */}
      <AddStorageModal
        isOpen={showAddStorage}
        onClose={() => setShowAddStorage(false)}
        onAdd={handleAddStorage}
      />

      {/* Spotlight Search */}
      <SpotlightSearch
        isOpen={spotlightOpen}
        onClose={handleCloseSpotlight}
        files={files}
        sources={sources}
        currentSourceId={selectedSource?.id}
        onNavigateToFile={(file) => {
          if (file.isDirectory) {
            navigateTo(file.path);
          } else {
            // Select the file
            setSelectedFiles(new Set([file.path]));
            // Open info modal
            setInfoModal({ visible: true, file });
          }
          handleCloseSpotlight();
        }}
        onNavigateToPath={(sourceId, path) => {
          const source = sources.find((s) => s.id === sourceId);
          if (source) {
            selectSource(source);
            navigateTo(path);
          }
          handleCloseSpotlight();
        }}
        onSearchSubmit={(query) => {
          setSearchQuery(query);
          handleCloseSpotlight();
        }}
      />

      {/* File Operation Progress */}
      {fileOperation?.inProgress && (
        <div className="file-operation-toast">
          <div className="operation-spinner" />
          <span>{fileOperation.type}...</span>
        </div>
      )}

      {/* Keyboard Shortcut Helper */}
      <KeyboardShortcutHelper
        isOpen={shortcutHelper.isOpen}
        onClose={shortcutHelper.close}
      />

      {/* Keyboard Shortcut Settings */}
      <ShortcutSettings
        isOpen={showShortcutSettings}
        onClose={() => setShowShortcutSettings(false)}
      />
    </div>
  );
}

// Helper functions

// Get cyberpunk icon component based on folder name
function getLocationIcon(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName === 'home' || lowerName.includes('user')) return IconHome;
  if (lowerName === 'desktop') return IconDesktop;
  if (lowerName === 'documents' || lowerName === 'docs') return IconDocuments;
  if (lowerName === 'downloads') return IconDownloads;
  if (lowerName === 'pictures' || lowerName === 'photos') return IconPictures;
  if (lowerName === 'music' || lowerName === 'audio') return IconMusic;
  if (lowerName === 'volumes' || lowerName === 'drives') return IconVolumes;
  return IconFolder;
}

// Get storage icon based on category
function getStorageIcon(source: StorageSource) {
  switch (source.category) {
    case 'local':
      return getLocationIcon(source.name);
    case 'cloud':
      return IconCloud;
    case 'network':
      return IconNetwork;
    case 'hybrid':
      return IconDatabase;
    default:
      return IconFolder;
  }
}

/**
 * Get storage display label with naming conventions
 * Follows standard naming patterns:
 * - SMB/CIFS: \\server\share or //server/share
 * - NFS: server:/export
 * - S3: s3://bucket/prefix
 * - Cloud: provider://container
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getStorageDisplayLabel(_source: StorageSource): string {
  const { providerId, name, config } = _source;

  // For named sources, just return the name
  if (name && !name.includes('/') && !name.includes('\\')) {
    return name;
  }

  // Format based on provider type
  switch (providerId) {
    case 'smb':
    case 'cifs': {
      const server = config?.server as string;
      const share = config?.share as string;
      if (server && share) {
        // Windows UNC format
        return `\\\\${server}\\${share}`;
      }
      return name;
    }
    case 'nfs': {
      const server = config?.server as string;
      const exportPath = config?.export as string;
      if (server && exportPath) {
        // NFS format: server:/export
        return `${server}:${exportPath}`;
      }
      return name;
    }
    case 'aws-s3':
    case 's3-compatible': {
      const bucket = config?.bucket as string;
      const prefix = config?.prefix as string;
      if (bucket) {
        // S3 URI format
        return prefix ? `s3://${bucket}/${prefix}` : `s3://${bucket}`;
      }
      return name;
    }
    case 'gcs': {
      const bucket = config?.bucket as string;
      if (bucket) {
        return `gs://${bucket}`;
      }
      return name;
    }
    case 'azure-blob': {
      const account = config?.accountName as string;
      const container = config?.container as string;
      if (account && container) {
        return `azure://${account}/${container}`;
      }
      return name;
    }
    case 'sftp': {
      const host = config?.host as string;
      const path = config?.remotePath as string;
      if (host) {
        return `sftp://${host}${path || '/'}`;
      }
      return name;
    }
    case 'webdav': {
      const url = config?.url as string;
      if (url) {
        return url.replace(/^https?:\/\//, 'dav://');
      }
      return name;
    }
    default:
      return name;
  }
}

function getFileIcon(file: FileMetadata, size = 48): React.ReactNode {
  const isFolder = file.mimeType === 'folder' || file.path.endsWith('/');

  if (isFolder) {
    // Use simple folder icon - cleaner at all sizes
    return (
      <IconFolder
        size={size}
        color="currentColor"
        glow={false}
        className="folder-icon"
      />
    );
  }

  // Use the helper function to get the appropriate icon component
  // All file icons use currentColor to inherit from CSS variables
  const IconComponent = getFileIconComponent(file.name, file.mimeType);
  return <IconComponent size={size} color="currentColor" glow={false} />;
}

function getTierIndicator(
  file: FileMetadata,
  progress?: WarmProgress,
): React.ReactNode {
  // Show progress indicator during warming
  if (progress && progress.status === 'warming') {
    return (
      <div className="tier-progress">
        <div
          className="progress-ring"
          style={{ '--progress': progress.progress } as React.CSSProperties}
        />
      </div>
    );
  }

  // Only show tier indicators for non-hot tiers (cold, nearline, archive)
  // Hot/local files don't need an indicator - that's the default state
  if (file.tierStatus === 'cold')
    return <span className="tier-dot cold" title="Cold Storage" />;
  if (file.tierStatus === 'nearline')
    return <span className="tier-dot nearline" title="Nearline Storage" />;
  if (file.tierStatus === 'archive')
    return <span className="tier-dot archive" title="Archive Storage" />;

  // No indicator for hot/local files - they're immediately accessible
  return null;
}

function getTierBadge(
  file: FileMetadata,
  progress?: WarmProgress,
): React.ReactNode {
  if (progress && progress.status === 'warming') {
    return (
      <span className="tier-badge warming">
        {progress.progress.toFixed(0)}%
      </span>
    );
  }
  if (file.isWarmed) return <span className="tier-badge hot">Hot</span>;
  if (file.tierStatus === 'cold')
    return <span className="tier-badge cold">Cold</span>;
  if (file.tierStatus === 'archive')
    return <span className="tier-badge archive">Archive</span>;
  return <span className="tier-badge">-</span>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
