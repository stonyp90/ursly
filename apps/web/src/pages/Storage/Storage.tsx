/**
 * Storage Page - Virtual File System Browser
 * Web version of the VFS browser, mirrors desktop Finder experience
 * Supports data hydration/tiering across storage tiers
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Chip,
  LinearProgress,
  Menu,
  MenuItem,
  Divider,
  TextField,
  InputAdornment,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Breadcrumbs,
  Link,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Snackbar,
} from '@mui/material';
import {
  Search,
  Refresh,
  GridView,
  ViewList,
  Folder,
  InsertDriveFile,
  Cloud,
  Storage as StorageIcon,
  CloudQueue,
  Dns,
  ContentCopy,
  ContentCut,
  ContentPaste,
  Delete,
  Star,
  StarBorder,
  Edit,
  Add,
  NavigateBefore,
  NavigateNext,
  KeyboardArrowUp,
  Info,
  CreateNewFolder,
  Sync,
  Whatshot,
  AcUnit,
  Archive,
  FolderSpecial,
  Home,
  Computer,
  SwapVert,
  CloudDownload,
  CloudUpload,
  Cached,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material';
import {
  StorageService,
  StorageSource,
  FileMetadata,
  TierType,
} from '../../services/storage.service';
import { TierMigrationModal } from './TierMigrationModal';
import './Storage.css';

// ================================
// Storage Tier Types & Configuration
// ================================
type StorageTier = 'hot' | 'warm' | 'cold' | 'nearline' | 'archive';

interface TierConfig {
  id: StorageTier;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  accessTime: string;
  costIndicator: number; // 1-5, lower is cheaper
  provider: string;
}

const TIER_CONFIGS: TierConfig[] = [
  {
    id: 'hot',
    name: 'Hot',
    description: 'Instantly accessible, high-performance SSD storage',
    icon: <Whatshot />,
    color: 'var(--cyber-green, #10B981)',
    accessTime: 'Instant',
    costIndicator: 5,
    provider: 'FSx for NetApp ONTAP (SSD)',
  },
  {
    id: 'warm',
    name: 'Warm',
    description: 'Frequently accessed data with moderate latency',
    icon: <Sync />,
    color: 'var(--cyber-yellow, #F59E0B)',
    accessTime: '< 1 second',
    costIndicator: 3,
    provider: 'FSx ONTAP Capacity Pool',
  },
  {
    id: 'nearline',
    name: 'Nearline',
    description: 'Metadata available, data retrieves on demand',
    icon: <CloudQueue />,
    color: 'var(--cyber-purple, #8B5CF6)',
    accessTime: '1-5 minutes',
    costIndicator: 2,
    provider: 'FSxN S3 Fabric Pool',
  },
  {
    id: 'cold',
    name: 'Cold',
    description: 'Infrequently accessed, cost-optimized storage',
    icon: <AcUnit />,
    color: 'var(--cyber-blue, #3B82F6)',
    accessTime: '1-12 hours',
    costIndicator: 1,
    provider: 'S3 Glacier Instant Retrieval',
  },
  {
    id: 'archive',
    name: 'Archive',
    description: 'Long-term preservation, lowest cost',
    icon: <Archive />,
    color: 'var(--text-muted, #6B7280)',
    accessTime: '12-48 hours',
    costIndicator: 0,
    provider: 'S3 Glacier Deep Archive',
  },
];

const getTierConfig = (tier: StorageTier): TierConfig => {
  return TIER_CONFIGS.find((t) => t.id === tier) || TIER_CONFIGS[0];
};

interface HydrationJob {
  id: string;
  files: FileMetadata[];
  sourceTier: StorageTier;
  targetTier: StorageTier;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  estimatedTime?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface HydrationDialogState {
  open: boolean;
  files: FileMetadata[];
  step: number;
}

const getSourceIcon = (providerId: string) => {
  switch (providerId) {
    case 'local':
      return <Computer />;
    case 's3':
    case 'aws-s3':
      return <Cloud />;
    case 'gcs':
      return <CloudQueue />;
    case 'azure-blob':
      return <Cloud />;
    case 'smb':
    case 'nfs':
      return <Dns />;
    case 'fsx-ontap':
      return <StorageIcon />;
    default:
      return <StorageIcon />;
  }
};

const _getCategoryIcon = (category: string) => {
  switch (category) {
    case 'local':
      return <Home />;
    case 'cloud':
      return <Cloud />;
    case 'network':
      return <Dns />;
    case 'hybrid':
      return <FolderSpecial />;
    default:
      return <StorageIcon />;
  }
};

const getTierColor = (tier?: string) => {
  switch (tier) {
    case 'hot':
      return 'var(--cyber-green, #10B981)';
    case 'warm':
      return 'var(--cyber-yellow, #F59E0B)';
    case 'cold':
      return 'var(--cyber-blue, #3B82F6)';
    case 'nearline':
      return 'var(--cyber-purple, #8B5CF6)';
    case 'archive':
      return 'var(--text-muted, #6B7280)';
    default:
      return 'var(--text-secondary, #9CA3AF)';
  }
};

const getTierIcon = (tier?: string) => {
  switch (tier) {
    case 'hot':
      return <Whatshot sx={{ fontSize: 14, color: getTierColor(tier) }} />;
    case 'warm':
      return <Sync sx={{ fontSize: 14, color: getTierColor(tier) }} />;
    case 'cold':
      return <AcUnit sx={{ fontSize: 14, color: getTierColor(tier) }} />;
    case 'archive':
      return <Archive sx={{ fontSize: 14, color: getTierColor(tier) }} />;
    default:
      return null;
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '--';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export function StoragePage() {
  const [sources, setSources] = useState<StorageSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<StorageSource | null>(
    null,
  );
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    file?: FileMetadata;
  } | null>(null);
  const [clipboardHasFiles, setClipboardHasFiles] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['/']);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Dialogs
  const [newFolderDialog, setNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean;
    file?: FileMetadata;
  }>({ open: false });
  const [renameName, setRenameName] = useState('');
  const [infoDialog, setInfoDialog] = useState<{
    open: boolean;
    file?: FileMetadata;
  }>({ open: false });
  const [addStorageDialog, setAddStorageDialog] = useState(false);
  const [_tierMigrationModal, setTierMigrationModal] = useState(false);

  // Get selected files for tier migration
  const selectedFilesList = files.filter((f) => selectedFiles.has(f.id));

  // Hydration / Tiering State
  const [hydrationDialog, setHydrationDialog] = useState<HydrationDialogState>({
    open: false,
    files: [],
    step: 0,
  });
  const [selectedTargetTier, setSelectedTargetTier] =
    useState<StorageTier>('hot');
  const [hydrationJobs, setHydrationJobs] = useState<HydrationJob[]>([]);
  const [hydrationSnackbar, setHydrationSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  // Load sources on mount
  useEffect(() => {
    loadSources();
  }, []);

  // Load files when source or path changes
  useEffect(() => {
    if (selectedSource) {
      loadFiles(selectedSource.id, currentPath);
    }
  }, [selectedSource?.id, currentPath]);

  const loadSources = async () => {
    try {
      const sourcesList = await StorageService.listSources();
      setSources(sourcesList);
      if (sourcesList.length > 0 && !selectedSource) {
        setSelectedSource(sourcesList[0]);
      }
    } catch (error) {
      console.error('Failed to load sources:', error);
    }
  };

  const loadFiles = async (sourceId: string, path: string) => {
    setLoading(true);
    try {
      const filesList = await StorageService.listFiles(sourceId, path);
      setFiles(filesList);
    } catch (error) {
      console.error('Failed to load files:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Navigation
  const navigateTo = useCallback(
    (path: string, addToHistory = true) => {
      setCurrentPath(path);
      setSelectedFiles(new Set());

      if (addToHistory) {
        setNavigationHistory((prev) => {
          const newHistory = prev.slice(0, historyIndex + 1);
          newHistory.push(path);
          return newHistory;
        });
        setHistoryIndex((prev) => prev + 1);
      }
    },
    [historyIndex],
  );

  const goBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      setCurrentPath(navigationHistory[historyIndex - 1]);
    }
  };

  const goForward = () => {
    if (historyIndex < navigationHistory.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      setCurrentPath(navigationHistory[historyIndex + 1]);
    }
  };

  const goUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      navigateTo('/' + parts.join('/') || '/');
    }
  };

  const selectSource = (source: StorageSource) => {
    if (selectedSource?.id === source.id) return;
    setSelectedSource(source);
    setCurrentPath('/');
    setNavigationHistory(['/']);
    setHistoryIndex(0);
    setSelectedFiles(new Set());
  };

  // File operations
  const handleFileClick = (file: FileMetadata, event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey) {
      setSelectedFiles((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(file.id)) {
          newSet.delete(file.id);
        } else {
          newSet.add(file.id);
        }
        return newSet;
      });
    } else {
      setSelectedFiles(new Set([file.id]));
    }
  };

  const handleFileDoubleClick = (file: FileMetadata) => {
    if (file.isDirectory) {
      navigateTo(file.path);
    }
  };

  const handleContextMenu = (event: React.MouseEvent, file?: FileMetadata) => {
    event.preventDefault();
    event.stopPropagation();

    if (file && !selectedFiles.has(file.id)) {
      setSelectedFiles(new Set([file.id]));
    }

    setClipboardHasFiles(StorageService.hasClipboardFiles());
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY, file });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // Clipboard operations
  const handleCopy = async () => {
    if (!selectedSource || selectedFiles.size === 0) return;
    const paths = files
      .filter((f) => selectedFiles.has(f.id))
      .map((f) => f.path);
    await StorageService.copyFiles(selectedSource.id, paths);
    setClipboardHasFiles(true);
    handleCloseContextMenu();
  };

  const handleCut = async () => {
    if (!selectedSource || selectedFiles.size === 0) return;
    const paths = files
      .filter((f) => selectedFiles.has(f.id))
      .map((f) => f.path);
    await StorageService.cutFiles(selectedSource.id, paths);
    setClipboardHasFiles(true);
    handleCloseContextMenu();
  };

  const handlePaste = async () => {
    if (!selectedSource || !StorageService.hasClipboardFiles()) return;
    try {
      await StorageService.pasteFiles(selectedSource.id, currentPath);
      await loadFiles(selectedSource.id, currentPath);
      setClipboardHasFiles(StorageService.hasClipboardFiles());
    } catch (error) {
      console.error('Paste failed:', error);
    }
    handleCloseContextMenu();
  };

  const handleDelete = async () => {
    if (!selectedSource || selectedFiles.size === 0) return;

    const confirmed = window.confirm(`Delete ${selectedFiles.size} item(s)?`);
    if (!confirmed) return;

    try {
      const paths = files
        .filter((f) => selectedFiles.has(f.id))
        .map((f) => f.path);
      for (const path of paths) {
        await StorageService.deleteFile(selectedSource.id, path);
      }
      await loadFiles(selectedSource.id, currentPath);
      setSelectedFiles(new Set());
    } catch (error) {
      console.error('Delete failed:', error);
    }
    handleCloseContextMenu();
  };

  const handleNewFolder = async () => {
    if (!selectedSource || !newFolderName.trim()) return;
    try {
      const path =
        currentPath === '/'
          ? `/${newFolderName}`
          : `${currentPath}/${newFolderName}`;
      await StorageService.createFolder(selectedSource.id, path);
      await loadFiles(selectedSource.id, currentPath);
      setNewFolderDialog(false);
      setNewFolderName('');
    } catch (error) {
      console.error('Create folder failed:', error);
    }
  };

  const handleRename = async () => {
    if (!selectedSource || !renameDialog.file || !renameName.trim()) return;
    try {
      const oldPath = renameDialog.file.path;
      const parts = oldPath.split('/');
      parts.pop();
      const newPath = `${parts.join('/')}/${renameName}`;
      await StorageService.renameFile(selectedSource.id, oldPath, newPath);
      await loadFiles(selectedSource.id, currentPath);
      setRenameDialog({ open: false });
      setRenameName('');
    } catch (error) {
      console.error('Rename failed:', error);
    }
  };

  const handleToggleFavorite = async (file: FileMetadata) => {
    if (!selectedSource) return;
    try {
      await StorageService.toggleFavorite(selectedSource.id, file.path);
      await loadFiles(selectedSource.id, currentPath);
    } catch (error) {
      console.error('Toggle favorite failed:', error);
    }
    handleCloseContextMenu();
  };

  const _handleOpenTierMigration = () => {
    if (selectedFiles.size > 0) {
      setTierMigrationModal(true);
    }
    handleCloseContextMenu();
  };

  const _handleQuickTierChange = async (targetTier: TierType) => {
    if (!selectedSource || selectedFiles.size === 0) return;

    try {
      await StorageService.requestHydration({
        sourceId: selectedSource.id,
        paths: selectedFilesList.map((f) => f.path),
        targetTier,
      });
      // Refresh file list to show updated tier status
      await loadFiles(selectedSource.id, currentPath);
      setSelectedFiles(new Set());
    } catch (error) {
      console.error('Tier migration failed:', error);
    }
  };

  // ================================
  // Hydration / Tiering Handlers
  // ================================

  /**
   * Open hydration dialog for selected files
   */
  const openHydrationDialog = (filesToHydrate?: FileMetadata[]) => {
    handleCloseContextMenu();

    const targetFiles =
      filesToHydrate || files.filter((f) => selectedFiles.has(f.id));
    if (targetFiles.length === 0) return;

    setHydrationDialog({
      open: true,
      files: targetFiles,
      step: 0,
    });

    // Pre-select target tier based on source tier (suggest promotion)
    const sourceTier = targetFiles[0]?.tierStatus || 'cold';
    const tierOrder: StorageTier[] = [
      'archive',
      'cold',
      'nearline',
      'warm',
      'hot',
    ];
    const currentIndex = tierOrder.indexOf(sourceTier as StorageTier);
    const suggestedTier =
      currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : 'hot';
    setSelectedTargetTier(suggestedTier);
  };

  /**
   * Close hydration dialog
   */
  const closeHydrationDialog = () => {
    setHydrationDialog({ open: false, files: [], step: 0 });
  };

  /**
   * Advance to next step in hydration wizard
   */
  const nextHydrationStep = () => {
    setHydrationDialog((prev) => ({ ...prev, step: prev.step + 1 }));
  };

  /**
   * Go back to previous step
   */
  const prevHydrationStep = () => {
    setHydrationDialog((prev) => ({
      ...prev,
      step: Math.max(0, prev.step - 1),
    }));
  };

  /**
   * Execute hydration job
   * This will call the cloud-native API when implemented
   */
  const executeHydration = async () => {
    if (!selectedSource || hydrationDialog.files.length === 0) return;

    const sourceTier =
      (hydrationDialog.files[0]?.tierStatus as StorageTier) || 'cold';
    const jobId = `hydration-${Date.now()}`;

    // Create job
    const newJob: HydrationJob = {
      id: jobId,
      files: hydrationDialog.files,
      sourceTier,
      targetTier: selectedTargetTier,
      status: 'in_progress',
      progress: 0,
      estimatedTime: getEstimatedTime(
        sourceTier,
        selectedTargetTier,
        hydrationDialog.files,
      ),
      startedAt: new Date().toISOString(),
    };

    setHydrationJobs((prev) => [...prev, newJob]);
    closeHydrationDialog();

    setHydrationSnackbar({
      open: true,
      message: `Hydration started: Moving ${hydrationDialog.files.length} file(s) from ${sourceTier} to ${selectedTargetTier}`,
      severity: 'info',
    });

    // Simulate progress (in production, this would poll the API)
    try {
      // TODO: Replace with actual API call
      // await StorageService.changeTier(selectedSource.id, paths, selectedTargetTier);

      // Simulate async hydration progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        setHydrationJobs((prev) =>
          prev.map((job) => (job.id === jobId ? { ...job, progress } : job)),
        );
      }

      // Complete job
      setHydrationJobs((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status: 'completed',
                progress: 100,
                completedAt: new Date().toISOString(),
              }
            : job,
        ),
      );

      setHydrationSnackbar({
        open: true,
        message: `Hydration complete: ${hydrationDialog.files.length} file(s) now in ${selectedTargetTier} tier`,
        severity: 'success',
      });

      // Refresh files
      await loadFiles(selectedSource.id, currentPath);
    } catch (error) {
      console.error('Hydration failed:', error);
      setHydrationJobs((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? { ...job, status: 'failed', error: String(error) }
            : job,
        ),
      );

      setHydrationSnackbar({
        open: true,
        message: `Hydration failed: ${error}`,
        severity: 'error',
      });
    }
  };

  /**
   * Estimate time for hydration based on tier transition
   */
  const getEstimatedTime = (
    source: StorageTier,
    target: StorageTier,
    files: FileMetadata[],
  ): string => {
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const sizeMB = totalSize / (1024 * 1024);

    // Estimated times based on tier transition
    const transitions: Record<string, number> = {
      'archive-hot': 24 * 60, // 24 hours in minutes
      'archive-warm': 12 * 60,
      'archive-nearline': 6 * 60,
      'archive-cold': 60,
      'cold-hot': 60,
      'cold-warm': 30,
      'cold-nearline': 15,
      'nearline-hot': 5,
      'nearline-warm': 2,
      'warm-hot': 1,
    };

    const key = `${source}-${target}`;
    const baseMinutes = transitions[key] || 5;
    const sizeMultiplier = Math.max(1, sizeMB / 1000);
    const totalMinutes = baseMinutes * sizeMultiplier;

    if (totalMinutes < 60) {
      return `~${Math.ceil(totalMinutes)} min`;
    } else if (totalMinutes < 24 * 60) {
      return `~${Math.ceil(totalMinutes / 60)} hours`;
    } else {
      return `~${Math.ceil(totalMinutes / (24 * 60))} days`;
    }
  };

  /**
   * Get available target tiers based on current tier
   */
  const _getAvailableTargetTiers = (currentTier: StorageTier): TierConfig[] => {
    // Can move to any tier except current
    return TIER_CONFIGS.filter((t) => t.id !== currentTier);
  };

  /**
   * Check if movement is a promotion (to faster tier) or demotion (to slower tier)
   */
  const isPromotion = (source: StorageTier, target: StorageTier): boolean => {
    const tierOrder: StorageTier[] = [
      'archive',
      'cold',
      'nearline',
      'warm',
      'hot',
    ];
    return tierOrder.indexOf(target) > tierOrder.indexOf(source);
  };

  // Breadcrumbs
  const breadcrumbs = currentPath.split('/').filter(Boolean);

  // Group sources by category
  const localSources = sources.filter((s) => s.category === 'local');
  const cloudSources = sources.filter((s) => s.category === 'cloud');
  const networkSources = sources.filter((s) => s.category === 'network');
  const hybridSources = sources.filter(
    (s) => s.category === 'hybrid' || s.category === 'block',
  );

  return (
    <Box className="storage-page">
      {/* Toolbar */}
      <Box className="storage-toolbar">
        <Box className="toolbar-nav">
          <IconButton
            onClick={goBack}
            disabled={historyIndex === 0}
            size="small"
          >
            <NavigateBefore />
          </IconButton>
          <IconButton
            onClick={goForward}
            disabled={historyIndex >= navigationHistory.length - 1}
            size="small"
          >
            <NavigateNext />
          </IconButton>
          <IconButton
            onClick={goUp}
            disabled={currentPath === '/'}
            size="small"
          >
            <KeyboardArrowUp />
          </IconButton>
        </Box>

        <Box className="toolbar-breadcrumb">
          <Breadcrumbs separator="›" sx={{ color: 'var(--text-secondary)' }}>
            <Link
              component="button"
              underline="hover"
              onClick={() => navigateTo('/')}
              sx={{ color: 'var(--primary)', cursor: 'pointer' }}
            >
              {selectedSource?.name || 'Root'}
            </Link>
            {breadcrumbs.map((crumb, index) => (
              <Link
                key={index}
                component="button"
                underline="hover"
                onClick={() =>
                  navigateTo('/' + breadcrumbs.slice(0, index + 1).join('/'))
                }
                sx={{
                  color:
                    index === breadcrumbs.length - 1
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {crumb}
              </Link>
            ))}
          </Breadcrumbs>
        </Box>

        <Box className="toolbar-actions">
          <TextField
            size="small"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'var(--text-muted)', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{ width: 200 }}
          />
          <IconButton
            onClick={() => loadFiles(selectedSource?.id || '', currentPath)}
            disabled={loading}
            size="small"
          >
            <Refresh
              sx={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
            />
          </IconButton>
          <IconButton
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            size="small"
          >
            {viewMode === 'grid' ? <ViewList /> : <GridView />}
          </IconButton>
        </Box>
      </Box>

      <Box className="storage-content">
        {/* Sidebar */}
        <Box className="storage-sidebar">
          {/* Local Sources */}
          {localSources.length > 0 && (
            <Box className="sidebar-section">
              <Typography className="sidebar-section-label">
                <Home sx={{ fontSize: 14, mr: 0.5 }} /> Locations
              </Typography>
              {localSources.map((source) => (
                <Box
                  key={source.id}
                  className={`source-item ${selectedSource?.id === source.id ? 'active' : ''}`}
                  onClick={() => selectSource(source)}
                >
                  <Box className="source-icon">
                    {getSourceIcon(source.providerId)}
                  </Box>
                  <Typography className="source-name">{source.name}</Typography>
                  <Box className={`source-status ${source.status}`} />
                </Box>
              ))}
            </Box>
          )}

          {/* Cloud Sources */}
          {cloudSources.length > 0 && (
            <Box className="sidebar-section">
              <Typography className="sidebar-section-label">
                <Cloud sx={{ fontSize: 14, mr: 0.5 }} /> Cloud
              </Typography>
              {cloudSources.map((source) => (
                <Box
                  key={source.id}
                  className={`source-item ${selectedSource?.id === source.id ? 'active' : ''} ${source.status !== 'connected' ? 'disconnected' : ''}`}
                  onClick={() =>
                    source.status === 'connected' && selectSource(source)
                  }
                >
                  <Box className="source-icon">
                    {getSourceIcon(source.providerId)}
                  </Box>
                  <Box className="source-info">
                    <Typography className="source-name">
                      {source.name}
                    </Typography>
                    <Typography className="source-type">
                      {source.providerId.toUpperCase()}
                    </Typography>
                  </Box>
                  <Box className={`source-status ${source.status}`} />
                </Box>
              ))}
            </Box>
          )}

          {/* Network Sources */}
          {networkSources.length > 0 && (
            <Box className="sidebar-section">
              <Typography className="sidebar-section-label">
                <Dns sx={{ fontSize: 14, mr: 0.5 }} /> Network
              </Typography>
              {networkSources.map((source) => (
                <Box
                  key={source.id}
                  className={`source-item ${selectedSource?.id === source.id ? 'active' : ''} ${source.status !== 'connected' ? 'disconnected' : ''}`}
                  onClick={() =>
                    source.status === 'connected' && selectSource(source)
                  }
                >
                  <Box className="source-icon">
                    {getSourceIcon(source.providerId)}
                  </Box>
                  <Box className="source-info">
                    <Typography className="source-name">
                      {source.name}
                    </Typography>
                    <Typography className="source-type">
                      {source.providerId.toUpperCase()}
                    </Typography>
                  </Box>
                  <Box className={`source-status ${source.status}`} />
                </Box>
              ))}
            </Box>
          )}

          {/* Hybrid/Block Sources */}
          {hybridSources.length > 0 && (
            <Box className="sidebar-section">
              <Typography className="sidebar-section-label">
                <FolderSpecial sx={{ fontSize: 14, mr: 0.5 }} /> Hybrid
              </Typography>
              {hybridSources.map((source) => (
                <Box
                  key={source.id}
                  className={`source-item ${selectedSource?.id === source.id ? 'active' : ''}`}
                  onClick={() => selectSource(source)}
                >
                  <Box className="source-icon">
                    {getSourceIcon(source.providerId)}
                  </Box>
                  <Typography className="source-name">{source.name}</Typography>
                  <Box className={`source-status ${source.status}`} />
                </Box>
              ))}
            </Box>
          )}

          {/* Add Storage Button */}
          <Button
            startIcon={<Add />}
            onClick={() => setAddStorageDialog(true)}
            sx={{ mt: 2, width: '100%', justifyContent: 'flex-start' }}
            size="small"
          >
            Add Storage
          </Button>

          {/* Storage Usage */}
          {selectedSource?.usedSpace && selectedSource?.totalSpace && (
            <Box className="storage-usage">
              <Typography variant="caption" className="usage-label">
                Storage Usage
              </Typography>
              <LinearProgress
                variant="determinate"
                value={
                  (selectedSource.usedSpace / selectedSource.totalSpace) * 100
                }
                sx={{
                  height: 4,
                  borderRadius: 1,
                  backgroundColor: 'var(--surface-elevated)',
                  '& .MuiLinearProgress-bar': {
                    background:
                      'linear-gradient(90deg, var(--primary), var(--secondary))',
                  },
                }}
              />
              <Typography variant="caption" className="usage-text">
                {formatBytes(selectedSource.usedSpace)} /{' '}
                {formatBytes(selectedSource.totalSpace)}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Main Browser */}
        <Box
          className="storage-browser"
          onContextMenu={(e) => handleContextMenu(e)}
        >
          {loading && (
            <LinearProgress
              sx={{ position: 'absolute', top: 0, left: 0, right: 0 }}
            />
          )}

          <Box className={`file-container ${viewMode}`}>
            {filteredFiles.map((file) => (
              <Card
                key={file.id}
                className={`file-card ${selectedFiles.has(file.id) ? 'selected' : ''}`}
                onClick={(e) => handleFileClick(file, e)}
                onDoubleClick={() => handleFileDoubleClick(file)}
                onContextMenu={(e) => handleContextMenu(e, file)}
              >
                <CardContent className="file-card-content">
                  <Box className="file-icon-wrapper">
                    {file.isDirectory ? (
                      <Folder
                        sx={{
                          fontSize: viewMode === 'grid' ? 48 : 24,
                          color: 'var(--primary)',
                        }}
                      />
                    ) : (
                      <InsertDriveFile
                        sx={{
                          fontSize: viewMode === 'grid' ? 48 : 24,
                          color: 'var(--text-secondary)',
                        }}
                      />
                    )}
                    {file.tierStatus && file.tierStatus !== 'hot' && (
                      <Tooltip title={`${file.tierStatus} tier`}>
                        <Box
                          className="tier-indicator"
                          sx={{
                            backgroundColor: getTierColor(file.tierStatus),
                          }}
                        />
                      </Tooltip>
                    )}
                    {file.isFavorite && (
                      <Star
                        className="favorite-star"
                        sx={{ color: 'var(--cyber-yellow, #F59E0B)' }}
                      />
                    )}
                  </Box>

                  <Box className="file-details">
                    <Typography className="file-name" title={file.name}>
                      {file.name}
                    </Typography>
                    {viewMode === 'list' && (
                      <Box className="file-meta-list">
                        <Typography variant="caption">
                          {file.lastModified}
                        </Typography>
                        <Typography variant="caption">
                          {formatBytes(file.size)}
                        </Typography>
                        {file.tierStatus && getTierIcon(file.tierStatus)}
                      </Box>
                    )}
                    {viewMode === 'grid' && (
                      <Box className="file-meta">
                        <Typography variant="caption">
                          {formatBytes(file.size)}
                        </Typography>
                        {file.tierStatus && file.tierStatus !== 'hot' && (
                          <Chip
                            label={file.tierStatus}
                            size="small"
                            sx={{
                              backgroundColor: `color-mix(in srgb, ${getTierColor(file.tierStatus)} 20%, transparent)`,
                              color: getTierColor(file.tierStatus),
                              fontSize: '10px',
                              height: 18,
                            }}
                          />
                        )}
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>

          {filteredFiles.length === 0 && !loading && (
            <Box className="empty-state">
              <Folder
                sx={{ fontSize: 64, color: 'var(--text-muted)', mb: 2 }}
              />
              <Typography variant="h6" color="text.secondary">
                {searchQuery
                  ? 'No files match your search'
                  : 'This folder is empty'}
              </Typography>
              <Button
                startIcon={<CreateNewFolder />}
                onClick={() => setNewFolderDialog(true)}
                sx={{ mt: 2 }}
              >
                Create Folder
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {contextMenu?.file && (
          <>
            <MenuItem
              onClick={() => {
                handleFileDoubleClick(contextMenu.file!);
                handleCloseContextMenu();
              }}
            >
              <Folder sx={{ mr: 1.5, fontSize: 18 }} />
              {contextMenu.file.isDirectory ? 'Open' : 'Open File'}
            </MenuItem>
            <Divider />
          </>
        )}

        {selectedFiles.size > 0 && (
          <>
            <MenuItem onClick={handleCopy}>
              <ContentCopy sx={{ mr: 1.5, fontSize: 18 }} /> Copy
            </MenuItem>
            <MenuItem onClick={handleCut}>
              <ContentCut sx={{ mr: 1.5, fontSize: 18 }} /> Cut
            </MenuItem>
          </>
        )}

        <MenuItem onClick={handlePaste} disabled={!clipboardHasFiles}>
          <ContentPaste sx={{ mr: 1.5, fontSize: 18 }} /> Paste
        </MenuItem>

        <Divider />

        <MenuItem onClick={() => setNewFolderDialog(true)}>
          <CreateNewFolder sx={{ mr: 1.5, fontSize: 18 }} /> New Folder
        </MenuItem>

        {contextMenu?.file && (
          <>
            <MenuItem
              onClick={() => {
                setRenameName(contextMenu.file!.name);
                setRenameDialog({ open: true, file: contextMenu.file });
                handleCloseContextMenu();
              }}
            >
              <Edit sx={{ mr: 1.5, fontSize: 18 }} /> Rename
            </MenuItem>
            <MenuItem onClick={() => handleToggleFavorite(contextMenu.file!)}>
              {contextMenu.file.isFavorite ? (
                <>
                  <StarBorder sx={{ mr: 1.5, fontSize: 18 }} /> Remove from
                  Favorites
                </>
              ) : (
                <>
                  <Star sx={{ mr: 1.5, fontSize: 18 }} /> Add to Favorites
                </>
              )}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setInfoDialog({ open: true, file: contextMenu.file });
                handleCloseContextMenu();
              }}
            >
              <Info sx={{ mr: 1.5, fontSize: 18 }} /> Get Info
            </MenuItem>

            {/* Tiering / Hydration Options */}
            {contextMenu.file.tierStatus && (
              <>
                <Divider />
                <MenuItem
                  onClick={() => openHydrationDialog([contextMenu.file!])}
                >
                  <SwapVert
                    sx={{ mr: 1.5, fontSize: 18, color: 'var(--cyber-purple)' }}
                  />
                  Change Storage Tier...
                </MenuItem>
                {contextMenu.file.tierStatus !== 'hot' && (
                  <MenuItem
                    onClick={() => {
                      setSelectedTargetTier('hot');
                      openHydrationDialog([contextMenu.file!]);
                    }}
                  >
                    <Whatshot
                      sx={{
                        mr: 1.5,
                        fontSize: 18,
                        color: 'var(--cyber-green)',
                      }}
                    />
                    Hydrate to Hot Tier
                  </MenuItem>
                )}
                {contextMenu.file.tierStatus === 'hot' && (
                  <MenuItem
                    onClick={() => {
                      setSelectedTargetTier('cold');
                      openHydrationDialog([contextMenu.file!]);
                    }}
                  >
                    <AcUnit
                      sx={{ mr: 1.5, fontSize: 18, color: 'var(--cyber-blue)' }}
                    />
                    Archive to Cold Tier
                  </MenuItem>
                )}
              </>
            )}
          </>
        )}

        {selectedFiles.size > 0 && (
          <>
            <Divider />
            <MenuItem
              onClick={handleDelete}
              sx={{ color: 'var(--error, #EF4444)' }}
            >
              <Delete sx={{ mr: 1.5, fontSize: 18 }} /> Delete
            </MenuItem>
          </>
        )}
      </Menu>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialog} onClose={() => setNewFolderDialog(false)}>
        <DialogTitle>New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Folder Name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNewFolder()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderDialog(false)}>Cancel</Button>
          <Button onClick={handleNewFolder} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog
        open={renameDialog.open}
        onClose={() => setRenameDialog({ open: false })}
      >
        <DialogTitle>Rename</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="New Name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialog({ open: false })}>
            Cancel
          </Button>
          <Button onClick={handleRename} variant="contained">
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Info Dialog */}
      <Dialog
        open={infoDialog.open}
        onClose={() => setInfoDialog({ open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {infoDialog.file?.isDirectory ? <Folder /> : <InsertDriveFile />}
            {infoDialog.file?.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          {infoDialog.file && (
            <List dense>
              <ListItem>
                <ListItemText
                  primary="Kind"
                  secondary={
                    infoDialog.file.isDirectory
                      ? 'Folder'
                      : infoDialog.file.mimeType
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Size"
                  secondary={formatBytes(infoDialog.file.size)}
                />
              </ListItem>
              <ListItem>
                <ListItemText primary="Path" secondary={infoDialog.file.path} />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Modified"
                  secondary={infoDialog.file.lastModified}
                />
              </ListItem>
              {infoDialog.file.tierStatus && (
                <ListItem>
                  <ListItemText
                    primary="Storage Tier"
                    secondary={
                      <Chip
                        label={infoDialog.file.tierStatus.toUpperCase()}
                        size="small"
                        sx={{
                          backgroundColor: `color-mix(in srgb, ${getTierColor(infoDialog.file.tierStatus)} 20%, transparent)`,
                          color: getTierColor(infoDialog.file.tierStatus),
                        }}
                      />
                    }
                  />
                </ListItem>
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoDialog({ open: false })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add Storage Dialog - Placeholder */}
      <Dialog
        open={addStorageDialog}
        onClose={() => setAddStorageDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Storage</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Storage configuration will be available in a future update.
            Currently supported backends:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <Computer />
              </ListItemIcon>
              <ListItemText primary="Local Filesystem" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Cloud />
              </ListItemIcon>
              <ListItemText primary="AWS S3" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CloudQueue />
              </ListItemIcon>
              <ListItemText primary="Google Cloud Storage" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Cloud />
              </ListItemIcon>
              <ListItemText primary="Azure Blob Storage" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Dns />
              </ListItemIcon>
              <ListItemText primary="SMB/CIFS Network Share" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Dns />
              </ListItemIcon>
              <ListItemText primary="NFS Mount" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <StorageIcon />
              </ListItemIcon>
              <ListItemText primary="FSx for NetApp ONTAP" />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddStorageDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Hydration / Tiering Dialog */}
      <Dialog
        open={hydrationDialog.open}
        onClose={closeHydrationDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: 'var(--surface, #1a1a2e)',
            border: '1px solid var(--border)',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-elevated)',
          }}
        >
          <SwapVert sx={{ color: 'var(--primary)' }} />
          <Box>
            <Typography variant="h6" component="span">
              Data Hydration
            </Typography>
            <Typography
              variant="caption"
              sx={{ display: 'block', color: 'var(--text-muted)' }}
            >
              Move files across storage tiers
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {/* Stepper */}
          <Stepper activeStep={hydrationDialog.step} sx={{ mb: 4 }}>
            <Step>
              <StepLabel>Select Files</StepLabel>
            </Step>
            <Step>
              <StepLabel>Choose Tier</StepLabel>
            </Step>
            <Step>
              <StepLabel>Confirm</StepLabel>
            </Step>
          </Stepper>

          {/* Step 0: Files Summary */}
          {hydrationDialog.step === 0 && (
            <Box>
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{ color: 'var(--text-secondary)' }}
              >
                Selected Files ({hydrationDialog.files.length})
              </Typography>

              <Box
                sx={{
                  maxHeight: 200,
                  overflow: 'auto',
                  mb: 2,
                  border: '1px solid var(--border)',
                  borderRadius: 1,
                  background: 'var(--surface)',
                }}
              >
                <List dense>
                  {hydrationDialog.files.map((file, idx) => (
                    <ListItem
                      key={idx}
                      sx={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <ListItemIcon>
                        {file.isDirectory ? (
                          <Folder color="primary" />
                        ) : (
                          <InsertDriveFile color="action" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        secondary={
                          <Box
                            sx={{
                              display: 'flex',
                              gap: 2,
                              alignItems: 'center',
                            }}
                          >
                            <span>{formatBytes(file.size)}</span>
                            {file.tierStatus && (
                              <Chip
                                label={file.tierStatus.toUpperCase()}
                                size="small"
                                sx={{
                                  backgroundColor: `color-mix(in srgb, ${getTierColor(file.tierStatus)} 20%, transparent)`,
                                  color: getTierColor(file.tierStatus),
                                  fontSize: 10,
                                  height: 18,
                                }}
                              />
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>

              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Current tier:{' '}
                  <strong>
                    {hydrationDialog.files[0]?.tierStatus?.toUpperCase() ||
                      'Unknown'}
                  </strong>
                </Typography>
              </Alert>
            </Box>
          )}

          {/* Step 1: Choose Target Tier */}
          {hydrationDialog.step === 1 && (
            <Box>
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{ color: 'var(--text-secondary)', mb: 2 }}
              >
                Select Target Storage Tier
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {TIER_CONFIGS.map((tier) => {
                  const currentTier = hydrationDialog.files[0]
                    ?.tierStatus as StorageTier;
                  const isCurrent = tier.id === currentTier;
                  const isSelected = tier.id === selectedTargetTier;
                  const promoting =
                    !isCurrent && isPromotion(currentTier, tier.id);

                  return (
                    <Card
                      key={tier.id}
                      onClick={() =>
                        !isCurrent && setSelectedTargetTier(tier.id)
                      }
                      sx={{
                        cursor: isCurrent ? 'not-allowed' : 'pointer',
                        opacity: isCurrent ? 0.5 : 1,
                        border: isSelected
                          ? `2px solid ${tier.color}`
                          : '1px solid var(--border)',
                        background: isSelected
                          ? `color-mix(in srgb, ${tier.color} 10%, var(--surface))`
                          : 'var(--surface)',
                        transition: 'all 0.2s ease',
                        '&:hover': !isCurrent
                          ? {
                              borderColor: tier.color,
                              transform: 'translateX(4px)',
                            }
                          : {},
                      }}
                    >
                      <CardContent
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          py: 1.5,
                        }}
                      >
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `color-mix(in srgb, ${tier.color} 20%, transparent)`,
                            color: tier.color,
                          }}
                        >
                          {tier.icon}
                        </Box>

                        <Box sx={{ flex: 1 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 600 }}
                            >
                              {tier.name}
                            </Typography>
                            {isCurrent && (
                              <Chip
                                label="Current"
                                size="small"
                                color="primary"
                              />
                            )}
                            {!isCurrent && promoting && (
                              <TrendingUp
                                sx={{
                                  fontSize: 16,
                                  color: 'var(--cyber-green)',
                                }}
                              />
                            )}
                            {!isCurrent && !promoting && (
                              <TrendingDown
                                sx={{
                                  fontSize: 16,
                                  color: 'var(--cyber-blue)',
                                }}
                              />
                            )}
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {tier.description}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                            <Typography variant="caption" color="text.muted">
                              Access: {tier.accessTime}
                            </Typography>
                            <Typography variant="caption" color="text.muted">
                              Provider: {tier.provider}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="caption" color="text.muted">
                            Cost
                          </Typography>
                          <Box
                            sx={{
                              display: 'flex',
                              gap: 0.25,
                              justifyContent: 'center',
                            }}
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Box
                                key={n}
                                sx={{
                                  width: 6,
                                  height: 16,
                                  borderRadius: 0.5,
                                  background:
                                    n <= tier.costIndicator
                                      ? tier.color
                                      : 'var(--border)',
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Step 2: Confirmation */}
          {hydrationDialog.step === 2 && (
            <Box>
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{ color: 'var(--text-secondary)', mb: 2 }}
              >
                Confirm Hydration
              </Typography>

              <Card
                sx={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  mb: 3,
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      justifyContent: 'center',
                    }}
                  >
                    {/* Source Tier */}
                    <Box sx={{ textAlign: 'center' }}>
                      <Box
                        sx={{
                          width: 64,
                          height: 64,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: `color-mix(in srgb, ${getTierColor(hydrationDialog.files[0]?.tierStatus)} 20%, transparent)`,
                          color: getTierColor(
                            hydrationDialog.files[0]?.tierStatus,
                          ),
                          margin: '0 auto 8px',
                        }}
                      >
                        {getTierIcon(hydrationDialog.files[0]?.tierStatus)}
                      </Box>
                      <Typography variant="body2" fontWeight={600}>
                        {hydrationDialog.files[0]?.tierStatus?.toUpperCase() ||
                          'Unknown'}
                      </Typography>
                      <Typography variant="caption" color="text.muted">
                        Current Tier
                      </Typography>
                    </Box>

                    {/* Arrow */}
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        color: 'var(--primary)',
                      }}
                    >
                      {isPromotion(
                        (hydrationDialog.files[0]?.tierStatus as StorageTier) ||
                          'cold',
                        selectedTargetTier,
                      ) ? (
                        <>
                          <CloudUpload sx={{ fontSize: 32 }} />
                          <Typography variant="caption" color="success.main">
                            Hydrating
                          </Typography>
                        </>
                      ) : (
                        <>
                          <CloudDownload sx={{ fontSize: 32 }} />
                          <Typography variant="caption" color="info.main">
                            Archiving
                          </Typography>
                        </>
                      )}
                    </Box>

                    {/* Target Tier */}
                    <Box sx={{ textAlign: 'center' }}>
                      <Box
                        sx={{
                          width: 64,
                          height: 64,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: `color-mix(in srgb, ${getTierColor(selectedTargetTier)} 20%, transparent)`,
                          color: getTierColor(selectedTargetTier),
                          margin: '0 auto 8px',
                        }}
                      >
                        {getTierIcon(selectedTargetTier)}
                      </Box>
                      <Typography variant="body2" fontWeight={600}>
                        {selectedTargetTier.toUpperCase()}
                      </Typography>
                      <Typography variant="caption" color="text.muted">
                        Target Tier
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <List
                dense
                sx={{
                  background: 'var(--surface)',
                  borderRadius: 1,
                  border: '1px solid var(--border)',
                }}
              >
                <ListItem>
                  <ListItemText
                    primary="Files to move"
                    secondary={`${hydrationDialog.files.length} file(s)`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Total size"
                    secondary={formatBytes(
                      hydrationDialog.files.reduce((sum, f) => sum + f.size, 0),
                    )}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Estimated time"
                    secondary={getEstimatedTime(
                      (hydrationDialog.files[0]?.tierStatus as StorageTier) ||
                        'cold',
                      selectedTargetTier,
                      hydrationDialog.files,
                    )}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Provider"
                    secondary={getTierConfig(selectedTargetTier).provider}
                  />
                </ListItem>
              </List>

              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  This operation will initiate a data movement job. Depending on
                  the source tier, retrieval may take time. You will be notified
                  when complete.
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ borderTop: '1px solid var(--border)', p: 2 }}>
          <Button onClick={closeHydrationDialog}>Cancel</Button>
          {hydrationDialog.step > 0 && (
            <Button onClick={prevHydrationStep}>Back</Button>
          )}
          {hydrationDialog.step < 2 && (
            <Button
              variant="contained"
              onClick={nextHydrationStep}
              disabled={
                hydrationDialog.step === 1 &&
                selectedTargetTier === hydrationDialog.files[0]?.tierStatus
              }
            >
              Next
            </Button>
          )}
          {hydrationDialog.step === 2 && (
            <Button
              variant="contained"
              onClick={executeHydration}
              startIcon={
                isPromotion(
                  (hydrationDialog.files[0]?.tierStatus as StorageTier) ||
                    'cold',
                  selectedTargetTier,
                ) ? (
                  <Whatshot />
                ) : (
                  <AcUnit />
                )
              }
              sx={{
                background: isPromotion(
                  (hydrationDialog.files[0]?.tierStatus as StorageTier) ||
                    'cold',
                  selectedTargetTier,
                )
                  ? 'linear-gradient(135deg, var(--cyber-green), var(--primary))'
                  : 'linear-gradient(135deg, var(--cyber-blue), var(--primary))',
              }}
            >
              {isPromotion(
                (hydrationDialog.files[0]?.tierStatus as StorageTier) || 'cold',
                selectedTargetTier,
              )
                ? 'Start Hydration'
                : 'Start Archive'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Hydration Progress Snackbar */}
      <Snackbar
        open={hydrationSnackbar.open}
        autoHideDuration={6000}
        onClose={() =>
          setHydrationSnackbar((prev) => ({ ...prev, open: false }))
        }
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() =>
            setHydrationSnackbar((prev) => ({ ...prev, open: false }))
          }
          severity={hydrationSnackbar.severity}
          sx={{ width: '100%' }}
        >
          {hydrationSnackbar.message}
        </Alert>
      </Snackbar>

      {/* Active Hydration Jobs Indicator */}
      {hydrationJobs.filter((j) => j.status === 'in_progress').length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 2,
            p: 2,
            minWidth: 280,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Cached
              sx={{ animation: 'spin 2s linear infinite', fontSize: 18 }}
            />
            Hydration in Progress
          </Typography>
          {hydrationJobs
            .filter((j) => j.status === 'in_progress')
            .map((job) => (
              <Box key={job.id} sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {job.files.length} file(s) → {job.targetTier.toUpperCase()}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={job.progress}
                  sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
                />
              </Box>
            ))}
        </Box>
      )}
    </Box>
  );
}

export default StoragePage;
