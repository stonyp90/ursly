//! Use Cases - Single-responsibility business logic operations

use anyhow::Result;
use std::path::Path;
use std::sync::Arc;

use crate::vfs::application::VfsService;
use crate::vfs::domain::{VirtualFile, StorageSource, TranscodeFormat};

/// Use case: List files in a storage source
pub struct ListFilesUseCase {
    vfs_service: Arc<VfsService>,
}

impl ListFilesUseCase {
    pub fn new(vfs_service: Arc<VfsService>) -> Self {
        Self { vfs_service }
    }
    
    pub async fn execute(&self, source_id: &str, path: &Path) -> Result<Vec<VirtualFile>> {
        self.vfs_service.list_files(source_id, path).await
    }
}

/// Use case: Hydrate a file from cold storage
pub struct HydrateFileUseCase {
    vfs_service: Arc<VfsService>,
}

impl HydrateFileUseCase {
    pub fn new(vfs_service: Arc<VfsService>) -> Self {
        Self { vfs_service }
    }
    
    pub async fn execute(&self, source_id: &str, path: &Path) -> Result<std::path::PathBuf> {
        self.vfs_service.hydrate_file(source_id, path).await
    }
}

/// Use case: Mount a storage source
pub struct MountStorageUseCase {
    vfs_service: Arc<VfsService>,
}

impl MountStorageUseCase {
    pub fn new(vfs_service: Arc<VfsService>) -> Self {
        Self { vfs_service }
    }
    
    pub async fn execute_local(&self, name: String, path: std::path::PathBuf) -> Result<StorageSource> {
        self.vfs_service.add_local_source(name, path).await
    }
}

/// Use case: Transcode a video file
pub struct TranscodeVideoUseCase {
    vfs_service: Arc<VfsService>,
}

impl TranscodeVideoUseCase {
    pub fn new(vfs_service: Arc<VfsService>) -> Self {
        Self { vfs_service }
    }
    
    /// Start transcoding a video file
    pub async fn execute(
        &self,
        source_id: &str,
        path: &Path,
        format: TranscodeFormat,
    ) -> Result<TranscodeJob> {
        // First, ensure file is hydrated
        let cache_path = self.vfs_service.hydrate_file(source_id, path).await?;
        
        // Create transcoding job (actual transcoding would be done by ffmpeg)
        let job = TranscodeJob {
            id: uuid::Uuid::new_v4().to_string(),
            source_path: path.to_path_buf(),
            cache_path,
            output_format: format,
            status: TranscodeJobStatus::Pending,
            progress: 0,
        };
        
        // TODO: Actually start ffmpeg process
        // For POC, we just return the job
        
        Ok(job)
    }
}

/// Transcode job status
#[derive(Debug, Clone)]
pub struct TranscodeJob {
    pub id: String,
    pub source_path: std::path::PathBuf,
    pub cache_path: std::path::PathBuf,
    pub output_format: TranscodeFormat,
    pub status: TranscodeJobStatus,
    pub progress: u8,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TranscodeJobStatus {
    Pending,
    Running,
    Completed,
    Failed(String),
}

/// Use case: Get cache statistics
pub struct GetCacheStatsUseCase {
    vfs_service: Arc<VfsService>,
}

impl GetCacheStatsUseCase {
    pub fn new(vfs_service: Arc<VfsService>) -> Self {
        Self { vfs_service }
    }
    
    pub async fn execute(&self) -> crate::vfs::ports::CacheStats {
        self.vfs_service.cache_stats().await
    }
}



