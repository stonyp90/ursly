//! NVMe Cache Adapter - High-performance local caching

use anyhow::{Context, Result};
use async_trait::async_trait;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::SystemTime;
use tokio::fs;
use tracing::{debug, info, warn};

use crate::vfs::domain::{CacheEntry, CacheConfig, EvictionPolicy};
use crate::vfs::ports::{CacheAdapter, CacheStats};

/// NVMe-optimized cache adapter
pub struct NvmeCacheAdapter {
    /// Cache configuration
    config: CacheConfig,
    
    /// Cache entries (path -> CacheEntry)
    entries: Arc<RwLock<HashMap<PathBuf, CacheEntry>>>,
    
    /// Statistics
    stats: Arc<RwLock<CacheStats>>,
}

impl NvmeCacheAdapter {
    pub async fn new(config: CacheConfig) -> Result<Self> {
        // Ensure cache directory exists
        fs::create_dir_all(&config.path).await?;
        
        info!("NVMe cache initialized at: {:?}", config.path);
        
        Ok(Self {
            config,
            entries: Arc::new(RwLock::new(HashMap::new())),
            stats: Arc::new(RwLock::new(CacheStats::default())),
        })
    }
    
    /// Generate cache path for a VFS path
    fn cache_path_for(&self, path: &Path) -> PathBuf {
        // Create a safe cache filename using hash
        let hash = format!("{:x}", md5::compute(path.to_string_lossy().as_bytes()));
        let extension = path.extension()
            .and_then(|e| e.to_str())
            .map(|e| format!(".{}", e))
            .unwrap_or_default();
        
        self.config.path.join(format!("{}{}", hash, extension))
    }
    
    /// Get current cache size
    fn current_size(&self) -> u64 {
        self.entries.read().values().map(|e| e.size).sum()
    }
    
    /// Select entries for eviction based on policy
    fn select_for_eviction(&self, required_space: u64) -> Vec<PathBuf> {
        let entries = self.entries.read();
        let current_size = self.current_size();
        
        if current_size + required_space <= self.config.max_size {
            return vec![];
        }
        
        let space_needed = current_size + required_space - self.config.max_size;
        let mut eviction_candidates: Vec<_> = entries.iter().collect();
        
        // Sort based on eviction policy
        match self.config.eviction_policy {
            EvictionPolicy::LRU => {
                eviction_candidates.sort_by(|a, b| a.1.last_accessed.cmp(&b.1.last_accessed));
            }
            EvictionPolicy::LFU => {
                eviction_candidates.sort_by(|a, b| a.1.access_count.cmp(&b.1.access_count));
            }
            EvictionPolicy::FIFO => {
                eviction_candidates.sort_by(|a, b| a.1.cached_at.cmp(&b.1.cached_at));
            }
        }
        
        let mut to_evict = Vec::new();
        let mut freed = 0u64;
        
        for (path, entry) in eviction_candidates {
            if freed >= space_needed {
                break;
            }
            to_evict.push(path.clone());
            freed += entry.size;
        }
        
        to_evict
    }
}

#[async_trait]
impl CacheAdapter for NvmeCacheAdapter {
    fn config(&self) -> &CacheConfig {
        &self.config
    }
    
    async fn is_cached(&self, path: &Path) -> bool {
        let cache_path = self.cache_path_for(path);
        
        if !cache_path.exists() {
            return false;
        }
        
        // Also check if entry is in our index
        self.entries.read().contains_key(path)
    }
    
    async fn get_cached_path(&self, path: &Path) -> Option<PathBuf> {
        if self.is_cached(path).await {
            Some(self.cache_path_for(path))
        } else {
            None
        }
    }
    
    async fn cache_file(&self, path: &Path, data: &[u8]) -> Result<CacheEntry> {
        let cache_path = self.cache_path_for(path);
        let size = data.len() as u64;
        
        // Evict if necessary
        if self.config.max_size > 0 {
            self.evict_if_needed(size).await?;
        }
        
        // Write to cache
        fs::write(&cache_path, data).await?;
        
        let now = SystemTime::now();
        let entry = CacheEntry {
            path: path.to_path_buf(),
            cache_path: cache_path.clone(),
            size,
            cached_at: now,
            last_accessed: now,
            access_count: 1,
        };
        
        // Update index
        self.entries.write().insert(path.to_path_buf(), entry.clone());
        
        // Update stats
        {
            let mut stats = self.stats.write();
            stats.total_size += size;
            stats.entry_count += 1;
        }
        
        debug!("Cached file: {:?} ({} bytes)", path, size);
        
        Ok(entry)
    }
    
    async fn read_from_cache(&self, path: &Path) -> Result<Vec<u8>> {
        let cache_path = self.cache_path_for(path);
        
        // Update access info
        {
            let mut entries = self.entries.write();
            if let Some(entry) = entries.get_mut(path) {
                entry.last_accessed = SystemTime::now();
                entry.access_count += 1;
            }
        }
        
        // Update hit stats
        self.stats.write().hit_count += 1;
        
        fs::read(&cache_path)
            .await
            .with_context(|| format!("Failed to read from cache: {:?}", cache_path))
    }
    
    async fn invalidate(&self, path: &Path) -> Result<()> {
        let cache_path = self.cache_path_for(path);
        
        // Remove from index
        if let Some(entry) = self.entries.write().remove(path) {
            // Update stats
            let mut stats = self.stats.write();
            stats.total_size = stats.total_size.saturating_sub(entry.size);
            stats.entry_count = stats.entry_count.saturating_sub(1);
        }
        
        // Remove file
        if cache_path.exists() {
            fs::remove_file(&cache_path).await?;
        }
        
        debug!("Invalidated cache entry: {:?}", path);
        
        Ok(())
    }
    
    async fn clear(&self) -> Result<()> {
        // Clear index
        self.entries.write().clear();
        
        // Reset stats
        *self.stats.write() = CacheStats::default();
        
        // Remove all files in cache directory
        let mut entries = fs::read_dir(&self.config.path).await?;
        while let Some(entry) = entries.next_entry().await? {
            if entry.path().is_file() {
                fs::remove_file(entry.path()).await?;
            }
        }
        
        info!("Cache cleared");
        
        Ok(())
    }
    
    async fn stats(&self) -> CacheStats {
        let mut stats = self.stats.read().clone();
        stats.max_size = self.config.max_size;
        stats
    }
    
    async fn evict_if_needed(&self, required_space: u64) -> Result<u64> {
        let to_evict = self.select_for_eviction(required_space);
        
        if to_evict.is_empty() {
            return Ok(0);
        }
        
        let mut freed = 0u64;
        
        // First, collect entries to remove without holding lock across await
        let mut entries_to_delete: Vec<(PathBuf, u64)> = Vec::new();
        
        for path in to_evict {
            let entry_opt = self.entries.write().remove(&path);
            if let Some(entry) = entry_opt {
                entries_to_delete.push((entry.cache_path.clone(), entry.size));
                freed += entry.size;
                
                // Update stats synchronously
                let mut stats = self.stats.write();
                stats.total_size = stats.total_size.saturating_sub(entry.size);
                stats.entry_count = stats.entry_count.saturating_sub(1);
                stats.eviction_count += 1;
            }
        }
        
        // Now delete files without holding any locks
        for (cache_path, _) in entries_to_delete {
            if cache_path.exists() {
                fs::remove_file(&cache_path).await.ok();
            }
        }
        
        info!("Evicted {} bytes from cache", freed);
        
        Ok(freed)
    }
    
    async fn touch(&self, path: &Path) -> Result<()> {
        let mut entries = self.entries.write();
        if let Some(entry) = entries.get_mut(path) {
            entry.last_accessed = SystemTime::now();
            entry.access_count += 1;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_cache_operations() {
        let temp_dir = TempDir::new().unwrap();
        let config = CacheConfig {
            path: temp_dir.path().to_path_buf(),
            max_size: 1024 * 1024, // 1 MB
            eviction_policy: EvictionPolicy::LRU,
            nvme_optimized: false,
        };
        
        let cache = NvmeCacheAdapter::new(config).await.unwrap();
        
        // Cache a file
        let data = b"Hello, World!";
        let path = Path::new("/test/file.txt");
        cache.cache_file(path, data).await.unwrap();
        
        // Check if cached
        assert!(cache.is_cached(path).await);
        
        // Read from cache
        let read_data = cache.read_from_cache(path).await.unwrap();
        assert_eq!(read_data, data);
        
        // Check stats
        let stats = cache.stats().await;
        assert_eq!(stats.hit_count, 1);
        assert_eq!(stats.entry_count, 1);
    }
    
    #[tokio::test]
    async fn test_cache_eviction() {
        let temp_dir = TempDir::new().unwrap();
        let config = CacheConfig {
            path: temp_dir.path().to_path_buf(),
            max_size: 100, // Very small cache
            eviction_policy: EvictionPolicy::LRU,
            nvme_optimized: false,
        };
        
        let cache = NvmeCacheAdapter::new(config).await.unwrap();
        
        // Fill cache
        let data1 = vec![0u8; 50];
        cache.cache_file(Path::new("/file1.txt"), &data1).await.unwrap();
        
        // This should trigger eviction
        let data2 = vec![0u8; 60];
        cache.cache_file(Path::new("/file2.txt"), &data2).await.unwrap();
        
        // First file should be evicted
        assert!(!cache.is_cached(Path::new("/file1.txt")).await);
        assert!(cache.is_cached(Path::new("/file2.txt")).await);
    }
    
    #[tokio::test]
    async fn test_cache_invalidation() {
        let temp_dir = TempDir::new().unwrap();
        let config = CacheConfig {
            path: temp_dir.path().to_path_buf(),
            max_size: 1024 * 1024,
            eviction_policy: EvictionPolicy::LRU,
            nvme_optimized: false,
        };
        
        let cache = NvmeCacheAdapter::new(config).await.unwrap();
        
        // Cache a file
        let data = b"Hello, World!";
        let path = Path::new("/test/file.txt");
        cache.cache_file(path, data).await.unwrap();
        
        assert!(cache.is_cached(path).await);
        
        // Invalidate
        cache.invalidate(path).await.unwrap();
        
        assert!(!cache.is_cached(path).await);
        
        // Stats should be updated
        let stats = cache.stats().await;
        assert_eq!(stats.entry_count, 0);
        assert_eq!(stats.total_size, 0);
    }
    
    #[tokio::test]
    async fn test_cache_clear() {
        let temp_dir = TempDir::new().unwrap();
        let config = CacheConfig {
            path: temp_dir.path().to_path_buf(),
            max_size: 1024 * 1024,
            eviction_policy: EvictionPolicy::LRU,
            nvme_optimized: false,
        };
        
        let cache = NvmeCacheAdapter::new(config).await.unwrap();
        
        // Cache multiple files
        cache.cache_file(Path::new("/file1.txt"), b"data1").await.unwrap();
        cache.cache_file(Path::new("/file2.txt"), b"data2").await.unwrap();
        cache.cache_file(Path::new("/file3.txt"), b"data3").await.unwrap();
        
        let stats = cache.stats().await;
        assert_eq!(stats.entry_count, 3);
        
        // Clear all
        cache.clear().await.unwrap();
        
        let stats = cache.stats().await;
        assert_eq!(stats.entry_count, 0);
        assert_eq!(stats.total_size, 0);
    }
    
    #[tokio::test]
    async fn test_cache_touch_updates_access() {
        let temp_dir = TempDir::new().unwrap();
        let config = CacheConfig {
            path: temp_dir.path().to_path_buf(),
            max_size: 1024 * 1024,
            eviction_policy: EvictionPolicy::LRU,
            nvme_optimized: false,
        };
        
        let cache = NvmeCacheAdapter::new(config).await.unwrap();
        
        let path = Path::new("/test/file.txt");
        cache.cache_file(path, b"data").await.unwrap();
        
        // Get initial access count
        let initial_count = cache.entries.read().get(path).unwrap().access_count;
        
        // Touch the file
        cache.touch(path).await.unwrap();
        
        // Access count should increase
        let updated_count = cache.entries.read().get(path).unwrap().access_count;
        assert_eq!(updated_count, initial_count + 1);
    }
    
    #[tokio::test]
    async fn test_cache_get_cached_path() {
        let temp_dir = TempDir::new().unwrap();
        let config = CacheConfig {
            path: temp_dir.path().to_path_buf(),
            max_size: 1024 * 1024,
            eviction_policy: EvictionPolicy::LRU,
            nvme_optimized: false,
        };
        
        let cache = NvmeCacheAdapter::new(config).await.unwrap();
        
        let path = Path::new("/test/file.txt");
        
        // Not cached yet
        assert!(cache.get_cached_path(path).await.is_none());
        
        // Cache it
        cache.cache_file(path, b"data").await.unwrap();
        
        // Should have a cached path now
        let cached_path = cache.get_cached_path(path).await;
        assert!(cached_path.is_some());
        assert!(cached_path.unwrap().exists());
    }
    
    #[test]
    fn test_eviction_policies() {
        // Test that eviction policy enum is properly defined
        let _lru = EvictionPolicy::LRU;
        let _lfu = EvictionPolicy::LFU;
        let _fifo = EvictionPolicy::FIFO;
    }
}

