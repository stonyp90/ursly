//! VFS Service - Main service orchestrating VFS operations

use anyhow::Result;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::SystemTime;
use tracing::{debug, error, info};

use crate::vfs::adapters::{LocalStorageAdapter, NvmeCacheAdapter};
use crate::vfs::domain::{
    StorageSource, StorageSourceType, ConnectionStatus, StorageConfig,
    VirtualFile, CacheConfig, StorageTier,
};
use crate::vfs::domain::events::*;
use crate::vfs::ports::{
    StorageAdapter, CacheAdapter, EventBus, CacheStats,
    IFileOperations, FileStat, CopyOptions, MoveOptions,
};

/// VFS Service - Orchestrates storage, caching, and hydration
pub struct VfsService {
    /// Registered storage sources
    sources: Arc<RwLock<HashMap<String, StorageSourceState>>>,
    
    /// Cache adapter
    cache: Arc<dyn CacheAdapter>,
    
    /// Event bus (optional, for Tauri integration)
    event_bus: Option<Arc<dyn EventBus>>,
}

struct StorageSourceState {
    source: StorageSource,
    adapter: Arc<dyn StorageAdapter>,
    /// Optional reference to file operations (same adapter, different trait)
    file_ops: Option<Arc<dyn IFileOperations>>,
}

impl VfsService {
    /// Create a new VFS service with default cache configuration
    pub async fn new() -> Result<Self> {
        let cache_config = CacheConfig::default();
        let cache = Arc::new(NvmeCacheAdapter::new(cache_config).await?);
        
        Ok(Self {
            sources: Arc::new(RwLock::new(HashMap::new())),
            cache,
            event_bus: None,
        })
    }
    
    /// Create with custom cache configuration
    pub async fn with_cache_config(cache_config: CacheConfig) -> Result<Self> {
        let cache = Arc::new(NvmeCacheAdapter::new(cache_config).await?);
        
        Ok(Self {
            sources: Arc::new(RwLock::new(HashMap::new())),
            cache,
            event_bus: None,
        })
    }
    
    /// Set the event bus for publishing domain events
    pub fn set_event_bus(&mut self, event_bus: Arc<dyn EventBus>) {
        self.event_bus = Some(event_bus);
    }
    
    /// Register a local storage source
    pub async fn add_local_source(&self, name: String, path: PathBuf) -> Result<StorageSource> {
        let adapter = Arc::new(LocalStorageAdapter::new(path.clone(), name.clone()));
        
        // LocalStorageAdapter implements both StorageAdapter and IFileOperations
        let file_ops: Arc<dyn IFileOperations> = adapter.clone();
        
        let source = StorageSource {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.clone(),
            source_type: StorageSourceType::Local,
            status: ConnectionStatus::Connected,
            mounted: true,
            mount_point: Some(path.clone()),
            config: StorageConfig {
                path_or_bucket: path.to_string_lossy().to_string(),
                ..Default::default()
            },
        };
        
        self.sources.write().insert(source.id.clone(), StorageSourceState {
            source: source.clone(),
            adapter,
            file_ops: Some(file_ops),
        });
        
        info!("Added local storage source: {} at {:?}", name, path);
        
        Ok(source)
    }
    
    /// Register an S3 storage source
    pub async fn add_s3_source(
        &self,
        name: String,
        bucket: String,
        region: String,
        access_key: Option<String>,
        secret_key: Option<String>,
        endpoint: Option<String>,
    ) -> Result<StorageSource> {
        use crate::vfs::adapters::S3StorageAdapter;
        
        let adapter = Arc::new(
            S3StorageAdapter::new(
                bucket.clone(),
                region.clone(),
                access_key.clone(),
                secret_key.clone(),
                endpoint.clone(),
                name.clone(),
            ).await?
        );
        
        let source = StorageSource {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.clone(),
            source_type: StorageSourceType::S3,
            status: ConnectionStatus::Connected,
            mounted: true,
            mount_point: None,
            config: StorageConfig {
                path_or_bucket: bucket,
                region: Some(region),
                endpoint,
                access_key,
                secret_key,
            },
        };
        
        self.sources.write().insert(source.id.clone(), StorageSourceState {
            source: source.clone(),
            adapter,
            file_ops: None, // S3 adapter doesn't implement IFileOperations yet
        });
        
        info!("Added S3 storage source: {}", name);
        
        Ok(source)
    }
    
    /// List all registered storage sources
    pub fn list_sources(&self) -> Vec<StorageSource> {
        self.sources.read()
            .values()
            .map(|s| s.source.clone())
            .collect()
    }
    
    /// Get a storage source by ID
    pub fn get_source(&self, source_id: &str) -> Option<StorageSource> {
        self.sources.read()
            .get(source_id)
            .map(|s| s.source.clone())
    }
    
    /// List files in a storage source
    pub async fn list_files(&self, source_id: &str, path: &Path) -> Result<Vec<VirtualFile>> {
        // Clone the adapter Arc before releasing the lock to avoid holding it across await
        let adapter = {
            let sources = self.sources.read();
            let state = sources.get(source_id)
                .ok_or_else(|| anyhow::anyhow!("Storage source not found: {}", source_id))?;
            state.adapter.clone()
        };
        
        let mut files = adapter.list_files(path).await?;
        
        // Update tier status for cached files
        for file in &mut files {
            if !file.is_directory {
                let file_path = file.path.clone();
                if self.cache.is_cached(&file_path).await {
                    file.tier_status.current_tier = StorageTier::Hot;
                    file.tier_status.is_cached = true;
                    file.tier_status.can_warm = false;
                }
            }
        }
        
        Ok(files)
    }
    
    /// Hydrate (warm) a file from cold storage to cache
    pub async fn hydrate_file(&self, source_id: &str, path: &Path) -> Result<PathBuf> {
        let start_time = std::time::Instant::now();
        
        let (adapter, source_tier) = {
            let sources = self.sources.read();
            let state = sources.get(source_id)
                .ok_or_else(|| anyhow::anyhow!("Storage source not found: {}", source_id))?;
            
            // Get current tier based on storage category
            let tier = match state.source.source_type.category() {
                crate::vfs::domain::StorageCategory::Local => StorageTier::Hot,
                crate::vfs::domain::StorageCategory::Block => StorageTier::Hot,
                crate::vfs::domain::StorageCategory::Cloud => StorageTier::Cold,
                crate::vfs::domain::StorageCategory::Network => StorageTier::Warm,
                crate::vfs::domain::StorageCategory::Hybrid => StorageTier::Cold,
                crate::vfs::domain::StorageCategory::Custom => StorageTier::Cold,
            };
            
            (state.adapter.clone(), tier)
        };
        
        // Publish hydration started event
        if let Some(event_bus) = &self.event_bus {
            let file_size = adapter.file_size(path).await.unwrap_or(0);
            event_bus.publish_hydration_started(FileHydrationStarted {
                file_path: path.to_path_buf(),
                source_tier,
                file_size,
                timestamp: SystemTime::now(),
            }).await?;
        }
        
        // Read file from source
        let data = adapter.read_file(path).await?;
        let bytes_transferred = data.len() as u64;
        
        // Cache the file
        let entry = self.cache.cache_file(path, &data).await?;
        
        let duration_ms = start_time.elapsed().as_millis() as u64;
        
        // Publish hydration completed event
        if let Some(event_bus) = &self.event_bus {
            event_bus.publish_hydration_completed(FileHydrationCompleted {
                file_path: path.to_path_buf(),
                source_tier,
                target_tier: StorageTier::Hot,
                bytes_transferred,
                duration_ms,
                timestamp: SystemTime::now(),
            }).await?;
        }
        
        info!("Hydrated file: {:?} ({} bytes in {}ms)", path, bytes_transferred, duration_ms);
        
        Ok(entry.cache_path)
    }
    
    /// Read a file (from cache if available, otherwise from source)
    pub async fn read_file(&self, source_id: &str, path: &Path) -> Result<Vec<u8>> {
        // Check cache first
        if self.cache.is_cached(path).await {
            debug!("Cache hit: {:?}", path);
            return self.cache.read_from_cache(path).await;
        }
        
        debug!("Cache miss: {:?}", path);
        
        // Read from source
        let sources = self.sources.read();
        let state = sources.get(source_id)
            .ok_or_else(|| anyhow::anyhow!("Storage source not found: {}", source_id))?;
        
        let data = state.adapter.read_file(path).await?;
        
        // Cache the file for future reads
        self.cache.cache_file(path, &data).await?;
        
        Ok(data)
    }
    
    /// Get cache statistics
    pub async fn cache_stats(&self) -> CacheStats {
        self.cache.stats().await
    }
    
    /// Clear the cache
    pub async fn clear_cache(&self) -> Result<()> {
        self.cache.clear().await
    }
    
    /// Remove a storage source
    pub fn remove_source(&self, source_id: &str) -> Option<StorageSource> {
        self.sources.write()
            .remove(source_id)
            .map(|s| s.source)
    }
    
    /// Get the real filesystem path for a file in a storage source
    /// This resolves VFS paths to actual filesystem paths for opening with native apps
    pub async fn get_real_path(&self, source_id: &str, path: &Path) -> Result<PathBuf> {
        let sources = self.sources.read();
        let state = sources.get(source_id)
            .ok_or_else(|| anyhow::anyhow!("Storage source not found: {}", source_id))?;
        
        // Get mount point from the source
        if let Some(mount_point) = &state.source.mount_point {
            // For local sources, combine mount point with relative path
            let real_path = if path.is_absolute() {
                // If path already starts with mount point, use as-is
                if path.starts_with(mount_point) {
                    path.to_path_buf()
                } else {
                    // Strip leading slash and append to mount point
                    let relative = path.strip_prefix("/").unwrap_or(path);
                    mount_point.join(relative)
                }
            } else {
                mount_point.join(path)
            };
            return Ok(real_path);
        }
        
        // For non-local sources (S3, etc.), we may need to download first
        // For now, return an error - future: use cache path
        Err(anyhow::anyhow!("Cannot get real path for non-local storage source"))
    }
    
    // =========================================================================
    // POSIX File Operations
    // =========================================================================
    
    /// Get file operations adapter for a source
    fn get_file_ops(&self, source_id: &str) -> Result<Arc<dyn IFileOperations>> {
        let sources = self.sources.read();
        let state = sources.get(source_id)
            .ok_or_else(|| anyhow::anyhow!("Storage source not found: {}", source_id))?;
        
        state.file_ops.clone()
            .ok_or_else(|| anyhow::anyhow!("Source does not support file operations"))
    }
    
    /// Create a directory
    pub async fn mkdir(&self, source_id: &str, path: &Path) -> Result<()> {
        let file_ops = self.get_file_ops(source_id)?;
        file_ops.mkdir(path).await
    }
    
    /// Create directory and all parents
    pub async fn mkdir_p(&self, source_id: &str, path: &Path) -> Result<()> {
        let file_ops = self.get_file_ops(source_id)?;
        file_ops.mkdir_p(path).await
    }
    
    /// Remove empty directory
    pub async fn rmdir(&self, source_id: &str, path: &Path) -> Result<()> {
        let file_ops = self.get_file_ops(source_id)?;
        file_ops.rmdir(path).await
    }
    
    /// Rename file or directory
    pub async fn rename(&self, source_id: &str, from: &Path, to: &Path) -> Result<()> {
        let file_ops = self.get_file_ops(source_id)?;
        file_ops.rename(from, to).await
    }
    
    /// Copy file or directory
    pub async fn copy(&self, source_id: &str, from: &Path, to: &Path, options: CopyOptions) -> Result<()> {
        let file_ops = self.get_file_ops(source_id)?;
        file_ops.copy(from, to, options).await
    }
    
    /// Move file or directory
    pub async fn mv(&self, source_id: &str, from: &Path, to: &Path, options: MoveOptions) -> Result<()> {
        let file_ops = self.get_file_ops(source_id)?;
        file_ops.mv(from, to, options).await
    }
    
    /// Remove file
    pub async fn rm(&self, source_id: &str, path: &Path) -> Result<()> {
        let file_ops = self.get_file_ops(source_id)?;
        file_ops.rm(path).await
    }
    
    /// Remove file or directory recursively
    pub async fn rm_rf(&self, source_id: &str, path: &Path) -> Result<()> {
        let file_ops = self.get_file_ops(source_id)?;
        file_ops.rm_rf(path).await
    }
    
    /// Change file permissions
    pub async fn chmod(&self, source_id: &str, path: &Path, mode: u32) -> Result<()> {
        let file_ops = self.get_file_ops(source_id)?;
        file_ops.chmod(path, mode).await
    }
    
    /// Get file statistics
    pub async fn stat(&self, source_id: &str, path: &Path) -> Result<FileStat> {
        let file_ops = self.get_file_ops(source_id)?;
        file_ops.stat(path).await
    }
    
    /// Touch file (create or update timestamp)
    pub async fn touch(&self, source_id: &str, path: &Path) -> Result<()> {
        let file_ops = self.get_file_ops(source_id)?;
        file_ops.touch(path).await
    }
    
    /// Check if path exists
    pub async fn exists(&self, source_id: &str, path: &Path) -> Result<bool> {
        let file_ops = self.get_file_ops(source_id)?;
        file_ops.exists(path).await
    }
    
    /// Read file contents
    pub async fn read(&self, source_id: &str, path: &Path) -> Result<Vec<u8>> {
        let file_ops = self.get_file_ops(source_id)?;
        file_ops.read(path).await
    }
    
    /// Write file contents
    pub async fn write(&self, source_id: &str, path: &Path, data: &[u8]) -> Result<()> {
        let file_ops = self.get_file_ops(source_id)?;
        file_ops.write(path, data).await
    }
    
    /// Append to file
    pub async fn append(&self, source_id: &str, path: &Path, data: &[u8]) -> Result<()> {
        let file_ops = self.get_file_ops(source_id)?;
        file_ops.append(path, data).await
    }
    
    // =========================================================================
    // Cross-Storage Operations
    // =========================================================================
    
    /// Copy files from one storage source to another
    pub async fn copy_to_source(
        &self,
        from_source_id: &str,
        from_path: &Path,
        to_source_id: &str,
        to_path: &Path,
    ) -> Result<u64> {
        let from_file_ops = self.get_file_ops(from_source_id)?;
        let to_file_ops = self.get_file_ops(to_source_id)?;
        
        // Get source file info
        let stat = from_file_ops.stat(from_path).await?;
        
        if stat.is_dir {
            // Recursive directory copy
            self.copy_dir_to_source(from_source_id, from_path, to_source_id, to_path).await
        } else {
            // Single file copy
            let data = from_file_ops.read(from_path).await?;
            let file_name = from_path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "file".to_string());
            let dest_path = to_path.join(&file_name);
            
            to_file_ops.write(&dest_path, &data).await?;
            
            info!("Copied {} to {} ({}:{:?})", 
                from_path.display(), 
                to_source_id, 
                dest_path.display(),
                stat.size
            );
            
            Ok(stat.size)
        }
    }
    
    /// Copy directory recursively between sources
    async fn copy_dir_to_source(
        &self,
        from_source_id: &str,
        from_path: &Path,
        to_source_id: &str,
        to_path: &Path,
    ) -> Result<u64> {
        let from_file_ops = self.get_file_ops(from_source_id)?;
        let to_file_ops = self.get_file_ops(to_source_id)?;
        
        let dir_name = from_path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "dir".to_string());
        let dest_dir = to_path.join(&dir_name);
        
        // Create destination directory
        to_file_ops.mkdir_p(&dest_dir).await?;
        
        let mut total_bytes = 0u64;
        
        // List source directory
        let entries = from_file_ops.list(from_path).await?;
        
        for entry in entries {
            let entry_path = from_path.join(&entry.name);
            
            if entry.is_dir {
                total_bytes += Box::pin(self.copy_dir_to_source(
                    from_source_id,
                    &entry_path,
                    to_source_id,
                    &dest_dir,
                )).await?;
            } else {
                let data = from_file_ops.read(&entry_path).await?;
                let dest_file = dest_dir.join(&entry.name);
                to_file_ops.write(&dest_file, &data).await?;
                total_bytes += entry.size;
            }
        }
        
        Ok(total_bytes)
    }
    
    /// Move files from one storage source to another (copy + delete)
    pub async fn move_to_source(
        &self,
        from_source_id: &str,
        from_path: &Path,
        to_source_id: &str,
        to_path: &Path,
    ) -> Result<u64> {
        // Copy first
        let bytes = self.copy_to_source(from_source_id, from_path, to_source_id, to_path).await?;
        
        // Delete source
        let from_file_ops = self.get_file_ops(from_source_id)?;
        from_file_ops.rm_rf(from_path).await?;
        
        info!("Moved {} from {} to {} ({} bytes)", 
            from_path.display(), 
            from_source_id, 
            to_source_id,
            bytes
        );
        
        Ok(bytes)
    }
    
    /// Get list of available storage sources for transfer
    pub fn get_transfer_targets(&self, exclude_source_id: Option<&str>) -> Vec<StorageSource> {
        let sources = self.sources.read();
        sources
            .values()
            .filter(|state| {
                state.source.status == ConnectionStatus::Connected
                    && exclude_source_id.map(|id| state.source.id != id).unwrap_or(true)
            })
            .map(|state| state.source.clone())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_vfs_service_local_source() {
        let temp_dir = TempDir::new().unwrap();
        
        // Create test file
        std::fs::write(temp_dir.path().join("test.txt"), "hello").unwrap();
        
        let service = VfsService::new().await.unwrap();
        
        // Add local source
        let source = service.add_local_source(
            "Test".to_string(),
            temp_dir.path().to_path_buf(),
        ).await.unwrap();
        
        assert_eq!(source.source_type, StorageSourceType::Local);
        assert_eq!(source.status, ConnectionStatus::Connected);
        
        // List files
        let files = service.list_files(&source.id, Path::new("/")).await.unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].name, "test.txt");
        
        // Read file
        let data = service.read_file(&source.id, Path::new("/test.txt")).await.unwrap();
        assert_eq!(data, b"hello");
    }
}

