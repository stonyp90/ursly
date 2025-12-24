/**
 * Tier Migration Modal - Hydration UI
 * Allows users to move files between storage tiers
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Whatshot,
  Sync,
  AcUnit,
  Archive,
  CloudQueue,
  InsertDriveFile,
  Folder,
  ArrowForward,
  Close,
  Check,
  Error as ErrorIcon,
  Schedule,
  AttachMoney,
  Speed,
} from '@mui/icons-material';
import {
  StorageService,
  FileMetadata,
  TierType,
  TierConfig,
  TierCostEstimate,
  HydrationJob,
} from '../../services/storage.service';

interface TierMigrationModalProps {
  open: boolean;
  onClose: () => void;
  sourceId: string;
  files: FileMetadata[];
  onComplete?: () => void;
}

const getTierIcon = (tier: TierType) => {
  switch (tier) {
    case 'hot':
      return <Whatshot />;
    case 'warm':
      return <Sync />;
    case 'cold':
      return <AcUnit />;
    case 'nearline':
      return <CloudQueue />;
    case 'archive':
      return <Archive />;
  }
};

const getTierColor = (tier: TierType) => {
  switch (tier) {
    case 'hot':
      return 'var(--cyber-green)';
    case 'warm':
      return 'var(--cyber-orange)';
    case 'cold':
      return 'var(--cyber-blue)';
    case 'nearline':
      return 'var(--cyber-purple)';
    case 'archive':
      return 'var(--text-muted)';
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export function TierMigrationModal({
  open,
  onClose,
  sourceId,
  files,
  onComplete,
}: TierMigrationModalProps) {
  const [tierConfigs, setTierConfigs] = useState<TierConfig[]>([]);
  const [selectedTier, setSelectedTier] = useState<TierType | null>(null);
  const [costEstimate, setCostEstimate] = useState<TierCostEstimate | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [job, setJob] = useState<HydrationJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Determine the current tier of selected files (majority)
  const currentTier = files[0]?.tierStatus || 'hot';
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  // Load tier configurations
  useEffect(() => {
    if (open) {
      StorageService.getTierConfigs().then(setTierConfigs);
    }
  }, [open]);

  // Estimate cost when tier is selected
  useEffect(() => {
    if (selectedTier && selectedTier !== currentTier) {
      setEstimating(true);
      setCostEstimate(null);
      StorageService.estimateTierMigration(
        sourceId,
        files.map((f) => f.path),
        selectedTier,
      )
        .then(setCostEstimate)
        .finally(() => setEstimating(false));
    } else {
      setCostEstimate(null);
    }
  }, [selectedTier, sourceId, files, currentTier]);

  const handleStartMigration = useCallback(async () => {
    if (!selectedTier) return;

    setLoading(true);
    setError(null);

    try {
      const newJob = await StorageService.requestHydration({
        sourceId,
        paths: files.map((f) => f.path),
        targetTier: selectedTier,
      });
      setJob(newJob);

      // Simulate progress for demo
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setJob((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'completed',
                  progress: 100,
                  filesCompleted: files.length,
                }
              : null,
          );
          setTimeout(() => {
            onComplete?.();
            onClose();
          }, 1500);
        } else {
          setJob((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'in_progress',
                  progress,
                  filesCompleted: Math.floor((progress / 100) * files.length),
                  bytesTransferred: Math.floor((progress / 100) * totalSize),
                }
              : null,
          );
        }
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setLoading(false);
    }
  }, [selectedTier, sourceId, files, totalSize, onComplete, onClose]);

  const handleClose = () => {
    if (!job || job.status === 'completed' || job.status === 'failed') {
      setSelectedTier(null);
      setCostEstimate(null);
      setJob(null);
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          pb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Whatshot sx={{ color: 'var(--primary)' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Move to Storage Tier
          </Typography>
        </Box>
        <IconButton
          onClick={handleClose}
          size="small"
          disabled={job?.status === 'in_progress'}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {/* Selected Files Summary */}
        <Alert
          severity="info"
          sx={{
            mb: 3,
            background: 'rgba(var(--primary-rgb), 0.1)',
            border: '1px solid rgba(var(--primary-rgb), 0.2)',
            '& .MuiAlert-icon': { color: 'var(--primary)' },
          }}
        >
          <Typography variant="body2">
            <strong>{files.length}</strong> file{files.length !== 1 ? 's' : ''}{' '}
            selected ({formatBytes(totalSize)})
          </Typography>
        </Alert>

        {/* Tier Flow Visualization */}
        {selectedTier && selectedTier !== currentTier && (
          <Box className="tier-flow">
            <Box className="tier-node source">
              <Box sx={{ color: getTierColor(currentTier as TierType) }}>
                {getTierIcon(currentTier as TierType)}
              </Box>
              <Typography className="tier-label">{currentTier}</Typography>
            </Box>
            <ArrowForward className="flow-arrow" />
            <Box className={`tier-node target ${selectedTier}`}>
              <Box sx={{ color: getTierColor(selectedTier) }}>
                {getTierIcon(selectedTier)}
              </Box>
              <Typography className="tier-label">{selectedTier}</Typography>
            </Box>
          </Box>
        )}

        {/* Tier Selection */}
        {!job && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="subtitle2"
              sx={{ mb: 2, color: 'var(--text-secondary)' }}
            >
              Select target tier:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {tierConfigs.map((tier) => (
                <Tooltip
                  key={tier.id}
                  title={
                    <Box>
                      <Typography variant="body2">
                        {tier.description}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        Retrieval: {tier.retrievalTime}
                      </Typography>
                      <Typography variant="caption">
                        ~${tier.costPerGB.toFixed(4)}/GB/month
                      </Typography>
                    </Box>
                  }
                  arrow
                >
                  <Chip
                    icon={getTierIcon(tier.id)}
                    label={tier.name}
                    onClick={() => setSelectedTier(tier.id)}
                    variant={selectedTier === tier.id ? 'filled' : 'outlined'}
                    disabled={tier.id === currentTier}
                    sx={{
                      borderColor:
                        selectedTier === tier.id
                          ? getTierColor(tier.id)
                          : 'var(--border)',
                      backgroundColor:
                        selectedTier === tier.id
                          ? `color-mix(in srgb, ${getTierColor(tier.id)} 20%, transparent)`
                          : 'transparent',
                      color:
                        tier.id === currentTier
                          ? 'var(--text-dim)'
                          : getTierColor(tier.id),
                      '& .MuiChip-icon': {
                        color:
                          tier.id === currentTier
                            ? 'var(--text-dim)'
                            : getTierColor(tier.id),
                      },
                      '&:hover': {
                        borderColor: getTierColor(tier.id),
                        backgroundColor: `color-mix(in srgb, ${getTierColor(tier.id)} 10%, transparent)`,
                      },
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>
        )}

        {/* Cost Estimate */}
        {estimating && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
            <LinearProgress sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Estimating...
            </Typography>
          </Box>
        )}

        {costEstimate && !job && (
          <Box className="cost-estimate">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule sx={{ fontSize: 18, color: 'var(--text-muted)' }} />
                <Box>
                  <Typography variant="caption" className="cost-label">
                    Est. Time
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {costEstimate.estimatedTime}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Speed sx={{ fontSize: 18, color: 'var(--text-muted)' }} />
                <Box>
                  <Typography variant="caption" className="cost-label">
                    Data Size
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatBytes(costEstimate.totalBytes)}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AttachMoney
                  sx={{ fontSize: 18, color: 'var(--cyber-green)' }}
                />
                <Box>
                  <Typography variant="caption" className="cost-label">
                    Est. Cost
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: 'var(--cyber-green)' }}
                  >
                    ${costEstimate.retrievalCost.toFixed(4)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* Progress Display */}
        {job && (
          <Box className="hydration-progress">
            <Box className="hydration-header">
              <Box className={`tier-icon ${job.targetTier}`}>
                {getTierIcon(job.targetTier)}
              </Box>
              <Box className="tier-text">
                <Typography component="h4">
                  Moving to{' '}
                  {job.targetTier.charAt(0).toUpperCase() +
                    job.targetTier.slice(1)}{' '}
                  Tier
                </Typography>
                <Typography component="p">
                  {job.status === 'completed'
                    ? 'Migration complete!'
                    : job.status === 'failed'
                      ? 'Migration failed'
                      : job.status === 'in_progress'
                        ? 'Processing...'
                        : 'Queued...'}
                </Typography>
              </Box>
              {job.status === 'completed' && (
                <Check sx={{ color: 'var(--cyber-green)', fontSize: 32 }} />
              )}
              {job.status === 'failed' && (
                <ErrorIcon sx={{ color: 'var(--error)', fontSize: 32 }} />
              )}
            </Box>

            <Box sx={{ my: 2 }}>
              <LinearProgress
                variant="determinate"
                value={job.progress}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'var(--surface-elevated)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    background:
                      job.status === 'completed'
                        ? 'var(--cyber-green)'
                        : job.status === 'failed'
                          ? 'var(--error)'
                          : `linear-gradient(90deg, var(--primary), ${getTierColor(job.targetTier)})`,
                  },
                }}
              />
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {job.filesCompleted} / {job.filesTotal} files
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatBytes(job.bytesTransferred)} /{' '}
                  {formatBytes(job.bytesTotal)}
                </Typography>
              </Box>
            </Box>

            {/* File List */}
            <Box className="hydration-file-list">
              <List dense disablePadding>
                {files.slice(0, 5).map((file, index) => {
                  const isCompleted = index < job.filesCompleted;
                  const isInProgress =
                    index === job.filesCompleted &&
                    job.status === 'in_progress';

                  return (
                    <ListItem key={file.id} className="hydration-file-item">
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {file.isDirectory ? (
                          <Folder
                            sx={{ color: 'var(--primary)', fontSize: 20 }}
                          />
                        ) : (
                          <InsertDriveFile
                            sx={{ color: 'var(--text-muted)', fontSize: 20 }}
                          />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        secondary={formatBytes(file.size)}
                        primaryTypographyProps={{
                          sx: { fontSize: 13, color: 'var(--text-primary)' },
                        }}
                        secondaryTypographyProps={{
                          sx: { fontSize: 11, fontFamily: 'JetBrains Mono' },
                        }}
                      />
                      <Box
                        className={`file-status ${isCompleted ? 'complete' : isInProgress ? 'in-progress' : 'pending'}`}
                      >
                        {isCompleted ? (
                          <>
                            <Check sx={{ fontSize: 14 }} /> Done
                          </>
                        ) : isInProgress ? (
                          <>
                            <Sync
                              sx={{
                                fontSize: 14,
                                animation: 'spin 1s linear infinite',
                              }}
                            />{' '}
                            Moving
                          </>
                        ) : (
                          <>
                            <Schedule sx={{ fontSize: 14 }} /> Pending
                          </>
                        )}
                      </Box>
                    </ListItem>
                  );
                })}
                {files.length > 5 && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      textAlign: 'center',
                      py: 1,
                      color: 'var(--text-muted)',
                    }}
                  >
                    +{files.length - 5} more files
                  </Typography>
                )}
              </List>
            </Box>
          </Box>
        )}

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions
        sx={{ px: 3, py: 2, borderTop: '1px solid var(--border)' }}
      >
        {!job ? (
          <>
            <Button onClick={handleClose} color="inherit">
              Cancel
            </Button>
            <Button
              onClick={handleStartMigration}
              variant="contained"
              disabled={
                !selectedTier || selectedTier === currentTier || loading
              }
              startIcon={getTierIcon(selectedTier || 'hot')}
              sx={{
                background: selectedTier
                  ? getTierColor(selectedTier)
                  : 'var(--primary)',
                '&:hover': {
                  background: selectedTier
                    ? `color-mix(in srgb, ${getTierColor(selectedTier)} 80%, black)`
                    : 'var(--primary)',
                },
              }}
            >
              {loading ? 'Starting...' : `Move to ${selectedTier || 'Tier'}`}
            </Button>
          </>
        ) : (
          <Button
            onClick={handleClose}
            variant="contained"
            disabled={job.status === 'in_progress'}
          >
            {job.status === 'completed'
              ? 'Done'
              : job.status === 'failed'
                ? 'Close'
                : 'Please wait...'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default TierMigrationModal;
