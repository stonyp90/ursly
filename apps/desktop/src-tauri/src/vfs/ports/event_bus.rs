//! Event Bus Port - Interface for event publishing

use anyhow::Result;
use async_trait::async_trait;

use crate::vfs::domain::events::*;

/// Event bus trait - Port for domain event publishing
#[async_trait]
pub trait EventBus: Send + Sync {
    /// Publish a file hydration started event
    async fn publish_hydration_started(&self, event: FileHydrationStarted) -> Result<()>;
    
    /// Publish a file hydration completed event
    async fn publish_hydration_completed(&self, event: FileHydrationCompleted) -> Result<()>;
    
    /// Publish a file hydration failed event
    async fn publish_hydration_failed(&self, event: FileHydrationFailed) -> Result<()>;
    
    /// Publish a storage mounted event
    async fn publish_storage_mounted(&self, event: StorageMounted) -> Result<()>;
    
    /// Publish a storage unmounted event
    async fn publish_storage_unmounted(&self, event: StorageUnmounted) -> Result<()>;
    
    /// Publish a transcode started event
    async fn publish_transcode_started(&self, event: TranscodeStarted) -> Result<()>;
    
    /// Publish a transcode progress event
    async fn publish_transcode_progress(&self, event: TranscodeProgress) -> Result<()>;
    
    /// Publish a transcode completed event
    async fn publish_transcode_completed(&self, event: TranscodeCompleted) -> Result<()>;
    
    /// Publish a cache eviction event
    async fn publish_cache_eviction(&self, event: CacheEviction) -> Result<()>;
}



