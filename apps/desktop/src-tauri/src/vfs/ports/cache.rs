//! Cache Port - Interface for cache adapters

use anyhow::Result;
use async_trait::async_trait;
use std::path::Path;

use crate::vfs::domain::{CacheEntry, CacheConfig};

/// Cache adapter trait - Port for caching backends
#[async_trait]
pub trait CacheAdapter: Send + Sync {
    /// Get cache configuration
    fn config(&self) -> &CacheConfig;
    
    /// Check if file is cached
    async fn is_cached(&self, path: &Path) -> bool;
    
    /// Get cached file path
    async fn get_cached_path(&self, path: &Path) -> Option<std::path::PathBuf>;
    
    /// Store file in cache
    async fn cache_file(&self, path: &Path, data: &[u8]) -> Result<CacheEntry>;
    
    /// Read file from cache
    async fn read_from_cache(&self, path: &Path) -> Result<Vec<u8>>;
    
    /// Invalidate cache entry
    async fn invalidate(&self, path: &Path) -> Result<()>;
    
    /// Clear entire cache
    async fn clear(&self) -> Result<()>;
    
    /// Get cache statistics
    async fn stats(&self) -> CacheStats;
    
    /// Evict entries if cache is full
    async fn evict_if_needed(&self, required_space: u64) -> Result<u64>;
    
    /// Touch entry to update access time (for LRU)
    async fn touch(&self, path: &Path) -> Result<()>;
}

/// Cache statistics
#[derive(Debug, Clone, Default)]
pub struct CacheStats {
    pub total_size: u64,
    pub max_size: u64,
    pub entry_count: u64,
    pub hit_count: u64,
    pub miss_count: u64,
    pub eviction_count: u64,
}

impl CacheStats {
    pub fn hit_rate(&self) -> f64 {
        let total = self.hit_count + self.miss_count;
        if total == 0 {
            0.0
        } else {
            self.hit_count as f64 / total as f64
        }
    }
    
    pub fn usage_percent(&self) -> f64 {
        if self.max_size == 0 {
            0.0
        } else {
            (self.total_size as f64 / self.max_size as f64) * 100.0
        }
    }
}



