//! Storage Sync Port - Interface for syncing data between storage backends
//!
//! Supports:
//! - S3 ↔ FSx ONTAP block storage sync (leveraging FSx ONTAP S3 integration)
//! - Tiering operations (nearline/cold → hot via NVMe cache)
//! - Batch operations on multi-select files/folders
//! - Integration with Windows Server 2025 Native NVMe (~80% IOPS boost)
//!
//! Reference architectures:
//! - https://aws.amazon.com/blogs/aws/amazon-fsx-for-netapp-ontap-now-integrates-with-amazon-s3/
//! - https://techcommunity.microsoft.com/blog/windowsservernewsandbestpractices/announcing-native-nvme-server-2025

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::vfs::domain::StorageTier;

/// Sync direction between storage backends
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SyncDirection {
    /// S3 → FSx ONTAP (object to block)
    ObjectToBlock,
    /// FSx ONTAP → S3 (block to object)
    BlockToObject,
    /// Any source → NVMe cache (hydration to hot tier)
    ToHot,
    /// NVMe cache → destination (flush from hot tier)
    FromHot,
    /// Bidirectional sync (two-way)
    Bidirectional,
}

/// Sync mode for conflict resolution
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SyncMode {
    /// Overwrite destination if source is newer
    NewerWins,
    /// Overwrite destination if source is larger
    LargerWins,
    /// Always overwrite destination
    ForceOverwrite,
    /// Skip files that exist at destination
    SkipExisting,
    /// Merge (keep both with suffix)
    Merge,
}

/// Sync operation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncRequest {
    /// Source storage ID
    pub from_source_id: String,
    
    /// Paths to sync (files and/or folders)
    pub from_paths: Vec<PathBuf>,
    
    /// Destination storage ID
    pub to_source_id: String,
    
    /// Destination base path
    pub to_path: PathBuf,
    
    /// Sync direction
    pub direction: SyncDirection,
    
    /// Sync mode for conflicts
    pub mode: SyncMode,
    
    /// Use NVMe cache as intermediate (for Windows Server 2025)
    pub use_nvme_cache: bool,
    
    /// Delete files at destination that don't exist at source
    pub delete_orphans: bool,
    
    /// Preserve tier status (e.g., keep cold files as cold)
    pub preserve_tier: bool,
    
    /// Priority (affects NVMe cache eviction)
    pub priority: SyncPriority,
}

/// Sync priority level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SyncPriority {
    /// Background sync (low priority, won't evict important cache)
    Background,
    /// Normal priority
    Normal,
    /// High priority (immediate, may evict cache)
    High,
    /// Critical (user-initiated, highest priority)
    Critical,
}

impl Default for SyncRequest {
    fn default() -> Self {
        Self {
            from_source_id: String::new(),
            from_paths: Vec::new(),
            to_source_id: String::new(),
            to_path: PathBuf::new(),
            direction: SyncDirection::ObjectToBlock,
            mode: SyncMode::NewerWins,
            use_nvme_cache: true,
            delete_orphans: false,
            preserve_tier: false,
            priority: SyncPriority::Normal,
        }
    }
}

/// Result of a sync operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    /// Number of files synced
    pub files_synced: usize,
    
    /// Number of files skipped
    pub files_skipped: usize,
    
    /// Number of files failed
    pub files_failed: usize,
    
    /// Bytes transferred
    pub bytes_transferred: u64,
    
    /// Files deleted at destination (if delete_orphans was true)
    pub files_deleted: usize,
    
    /// Errors encountered
    pub errors: Vec<String>,
    
    /// Duration in milliseconds
    pub duration_ms: u64,
    
    /// Used NVMe cache
    pub used_nvme_cache: bool,
    
    /// Cache hit rate (0-100)
    pub cache_hit_rate: Option<u8>,
}

/// Progress update during sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncProgress {
    /// Current file being synced
    pub current_file: String,
    
    /// Current operation (copy, compare, delete)
    pub operation: SyncOperation,
    
    /// Files completed
    pub files_completed: usize,
    
    /// Total files
    pub total_files: usize,
    
    /// Bytes transferred so far
    pub bytes_transferred: u64,
    
    /// Total bytes to transfer
    pub total_bytes: u64,
    
    /// Progress percentage (0-100)
    pub percent: u8,
    
    /// Current tier of file being processed
    pub current_tier: Option<StorageTier>,
    
    /// Is the file being cached to NVMe
    pub caching_to_nvme: bool,
}

/// Operation type during sync
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SyncOperation {
    /// Comparing files
    Comparing,
    /// Copying file
    Copying,
    /// Moving file
    Moving,
    /// Caching to NVMe
    Caching,
    /// Deleting orphan
    Deleting,
    /// Updating metadata
    UpdatingMetadata,
}

/// Available sync target
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncTarget {
    /// Storage source ID
    pub source_id: String,
    
    /// Display name
    pub name: String,
    
    /// Storage type for icon
    pub storage_type: String,
    
    /// Storage category
    pub category: String,
    
    /// Supported sync directions
    pub supported_directions: Vec<SyncDirection>,
    
    /// Has NVMe cache available
    pub has_nvme_cache: bool,
    
    /// Is FSx ONTAP with S3 integration
    pub has_s3_integration: bool,
    
    /// Current tier (for tiering displays)
    pub default_tier: Option<StorageTier>,
}

/// Tiering request (subset of sync for tier changes)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TieringRequest {
    /// Source storage ID
    pub source_id: String,
    
    /// Paths to tier
    pub paths: Vec<PathBuf>,
    
    /// Target tier
    pub target_tier: StorageTier,
    
    /// Priority
    pub priority: SyncPriority,
}

/// Storage sync service interface
#[async_trait]
pub trait IStorageSyncService: Send + Sync {
    /// Perform a sync operation
    async fn sync(&self, request: SyncRequest) -> Result<SyncResult>;
    
    /// Change tier of files (e.g., nearline → hot)
    async fn change_tier(&self, request: TieringRequest) -> Result<SyncResult>;
    
    /// Get available sync targets for a source
    async fn get_sync_targets(&self, source_id: &str) -> Result<Vec<SyncTarget>>;
    
    /// Estimate sync operation (time, bytes, files)
    async fn estimate_sync(&self, request: &SyncRequest) -> Result<SyncEstimate>;
    
    /// Check if NVMe cache is available and enabled (Windows Server 2025)
    async fn is_nvme_cache_available(&self) -> bool;
    
    /// Get NVMe cache statistics
    async fn get_nvme_stats(&self) -> Result<NvmeCacheStats>;
}

/// Sync estimate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncEstimate {
    /// Total files to sync
    pub total_files: usize,
    
    /// Total bytes to transfer
    pub total_bytes: u64,
    
    /// Files that need to be cached to NVMe first
    pub files_needing_cache: usize,
    
    /// Estimated duration in seconds
    pub estimated_seconds: Option<u64>,
    
    /// Will use NVMe acceleration
    pub nvme_accelerated: bool,
}

/// NVMe cache statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NvmeCacheStats {
    /// Total cache capacity in bytes
    pub capacity_bytes: u64,
    
    /// Used cache in bytes
    pub used_bytes: u64,
    
    /// Cache hit rate (0-100)
    pub hit_rate: u8,
    
    /// Files in cache
    pub cached_files: usize,
    
    /// Is Windows Server 2025 Native NVMe enabled
    pub native_nvme_enabled: bool,
    
    /// IOPS improvement factor (e.g., 1.8 for 80% improvement)
    pub iops_improvement: Option<f32>,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_sync_request_default() {
        let req = SyncRequest::default();
        assert!(req.use_nvme_cache);
        assert!(!req.delete_orphans);
        assert_eq!(req.mode, SyncMode::NewerWins);
    }
    
    #[test]
    fn test_sync_direction_s3_to_fsx() {
        let dir = SyncDirection::ObjectToBlock;
        assert_eq!(dir, SyncDirection::ObjectToBlock);
    }
    
    #[test]
    fn test_sync_priority_ordering() {
        // Higher priority should be used for user-initiated operations
        let bg = SyncPriority::Background;
        let crit = SyncPriority::Critical;
        assert_ne!(bg, crit);
    }
    
    #[test]
    fn test_tiering_request() {
        let req = TieringRequest {
            source_id: "s3-bucket".to_string(),
            paths: vec![PathBuf::from("/archive/video.mp4")],
            target_tier: StorageTier::Hot,
            priority: SyncPriority::Critical,
        };
        assert_eq!(req.target_tier, StorageTier::Hot);
    }
}


