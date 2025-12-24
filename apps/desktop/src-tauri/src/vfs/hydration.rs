use anyhow::{Context, Result};
use bytes::Bytes;
use opendal::{Operator, services};
use std::path::Path;
use std::sync::Arc;
use parking_lot::RwLock;
use tracing::{debug, info, warn};

use super::types::VfsStats;

/// Hydrated Operator manages transparent caching between remote (S3) and local (NVMe) storage
pub struct HydratedOperator {
    /// Remote storage operator (S3)
    remote: Operator,
    
    /// Local cache operator (Filesystem)
    local_cache: Operator,
    
    /// Statistics
    stats: Arc<RwLock<VfsStats>>,
}

impl HydratedOperator {
    /// Create a new HydratedOperator
    pub async fn new(
        bucket: &str,
        region: &str,
        cache_path: &Path,
        access_key: Option<String>,
        secret_key: Option<String>,
    ) -> Result<Self> {
        // Initialize S3 operator
        let mut s3_builder = services::S3::default();
        s3_builder
            .bucket(bucket)
            .region(region);
        
        if let (Some(key), Some(secret)) = (access_key, secret_key) {
            s3_builder
                .access_key_id(&key)
                .secret_access_key(&secret);
        }
        
        let remote = Operator::new(s3_builder)?
            .finish();
        
        info!("Initialized S3 operator for bucket: {}", bucket);
        
        // Initialize local filesystem operator
        let mut fs_builder = services::Fs::default();
        fs_builder.root(cache_path.to_str().unwrap());
        
        let local_cache = Operator::new(fs_builder)?
            .finish();
        
        info!("Initialized local cache at: {:?}", cache_path);
        
        Ok(Self {
            remote,
            local_cache,
            stats: Arc::new(RwLock::new(VfsStats::default())),
        })
    }
    
    /// Read a file with hydration (cache-aside pattern)
    pub async fn read(&self, path: &str) -> Result<Bytes> {
        // Normalize path (remove leading slash if present)
        let normalized_path = path.trim_start_matches('/');
        
        debug!("Reading file: {}", normalized_path);
        
        // 1. Check local cache first (fast path)
        if self.local_cache.is_exist(normalized_path).await? {
            debug!("⚡ Cache HIT: {}", normalized_path);
            let data = self.local_cache.read(normalized_path).await?;
            
            // Update stats
            {
                let mut stats = self.stats.write();
                stats.total_reads += 1;
                stats.cache_hits += 1;
            }
            
            return Ok(data.to_bytes());
        }
        
        // 2. Cache MISS - fetch from remote
        debug!("☁️  Cache MISS: Hydrating {} from S3", normalized_path);
        
        let data = self.remote.read(normalized_path).await
            .context(format!("Failed to read from S3: {}", normalized_path))?;
        
        let bytes = data.to_bytes();
        
        // Update stats
        {
            let mut stats = self.stats.write();
            stats.total_reads += 1;
            stats.cache_misses += 1;
            stats.bytes_downloaded += bytes.len() as u64;
        }
        
        // 3. Hydrate local cache (async, fire-and-forget or await based on policy)
        // For now, we await to ensure next read hits cache
        let cache_data = bytes.clone();
        if let Err(e) = self.local_cache.write(normalized_path, cache_data).await {
            warn!("Failed to cache file {}: {}", normalized_path, e);
        } else {
            debug!("✓ Cached {} to local storage", normalized_path);
        }
        
        Ok(bytes)
    }
    
    /// Check if a file exists (checks remote as source of truth)
    pub async fn exists(&self, path: &str) -> Result<bool> {
        let normalized_path = path.trim_start_matches('/');
        Ok(self.remote.is_exist(normalized_path).await?)
    }
    
    /// Get file metadata
    pub async fn metadata(&self, path: &str) -> Result<opendal::Metadata> {
        let normalized_path = path.trim_start_matches('/');
        Ok(self.remote.stat(normalized_path).await?)
    }
    
    /// List directory contents
    pub async fn list_dir(&self, path: &str) -> Result<Vec<opendal::Entry>> {
        let normalized_path = path.trim_start_matches('/');
        let dir_path = if normalized_path.is_empty() {
            "".to_string()
        } else {
            format!("{}/", normalized_path)
        };
        
        let lister = self.remote.lister(&dir_path).await?;
        let entries: Vec<opendal::Entry> = lister.collect().await;
        
        Ok(entries)
    }
    
    /// Write a file (write to cache first, then async sync to remote)
    pub async fn write(&self, path: &str, data: Bytes) -> Result<()> {
        let normalized_path = path.trim_start_matches('/');
        
        info!("Writing file: {}", normalized_path);
        
        // 1. Write to local cache immediately (optimistic UI)
        self.local_cache.write(normalized_path, data.clone()).await?;
        
        // 2. Sync to remote (in a real system, this would be queued)
        self.remote.write(normalized_path, data.clone()).await?;
        
        // Update stats
        {
            let mut stats = self.stats.write();
            stats.bytes_uploaded += data.len() as u64;
        }
        
        info!("✓ Written and synced: {}", normalized_path);
        Ok(())
    }
    
    /// Delete a file
    pub async fn delete(&self, path: &str) -> Result<()> {
        let normalized_path = path.trim_start_matches('/');
        
        info!("Deleting file: {}", normalized_path);
        
        // Delete from remote first
        self.remote.delete(normalized_path).await?;
        
        // Best-effort cleanup of cache
        let _ = self.local_cache.delete(normalized_path).await;
        
        Ok(())
    }
    
    /// Get current statistics
    pub fn get_stats(&self) -> VfsStats {
        self.stats.read().clone()
    }
}
