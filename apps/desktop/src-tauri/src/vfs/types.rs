use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use parking_lot::RwLock;

/// Configuration for mounting a virtual drive
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MountConfig {
    /// Mount point (e.g., "/Volumes/Ursly" on macOS, "U:\" on Windows)
    pub mount_point: PathBuf,
    
    /// Remote storage configuration (S3)
    pub remote: RemoteConfig,
    
    /// Local cache configuration (NVMe)
    pub local_cache: LocalCacheConfig,
}

/// Remote storage configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteConfig {
    /// S3 bucket name
    pub bucket: String,
    
    /// AWS region
    pub region: String,
    
    /// Optional: Access key (can also use IAM roles)
    pub access_key: Option<String>,
    
    /// Optional: Secret key
    pub secret_key: Option<String>,
    
    /// Optional: Endpoint override (for S3-compatible services)
    pub endpoint: Option<String>,
}

/// Local cache configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalCacheConfig {
    /// Path to cache directory (should be on NVMe for performance)
    pub cache_path: PathBuf,
    
    /// Maximum cache size in bytes (0 = unlimited)
    pub max_size: u64,
    
    /// Cache eviction policy
    pub eviction_policy: EvictionPolicy,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum EvictionPolicy {
    /// Least Recently Used
    LRU,
    /// Least Frequently Used
    LFU,
    /// First In First Out
    FIFO,
}

/// Inode to path mapping
pub type InodeMap = Arc<RwLock<HashMap<u64, PathBuf>>>;

/// File handle to path mapping
pub type FileHandleMap = Arc<RwLock<HashMap<u64, PathBuf>>>;

/// Mount status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MountStatus {
    pub mounted: bool,
    pub mount_point: Option<PathBuf>,
    pub cache_path: Option<PathBuf>,
    pub cache_size: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
}

/// Statistics for the VFS
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct VfsStats {
    pub total_reads: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub bytes_downloaded: u64,
    pub bytes_uploaded: u64,
}




