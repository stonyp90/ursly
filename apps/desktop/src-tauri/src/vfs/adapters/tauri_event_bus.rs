//! Tauri Event Bus Adapter - Publishes domain events via Tauri

use anyhow::Result;
use async_trait::async_trait;
use tauri::{AppHandle, Emitter};
use tracing::debug;

use crate::vfs::domain::events::*;
use crate::vfs::ports::EventBus;

/// Event bus that publishes to Tauri frontend
pub struct TauriEventBus {
    app_handle: AppHandle,
}

impl TauriEventBus {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }
    
    fn emit<T: serde::Serialize + Clone>(&self, event_name: &str, payload: T) -> Result<()> {
        debug!("Emitting event: {}", event_name);
        self.app_handle.emit(event_name, payload)?;
        Ok(())
    }
}

#[async_trait]
impl EventBus for TauriEventBus {
    async fn publish_hydration_started(&self, event: FileHydrationStarted) -> Result<()> {
        self.emit("vfs:hydration:started", event)
    }
    
    async fn publish_hydration_completed(&self, event: FileHydrationCompleted) -> Result<()> {
        self.emit("vfs:hydration:completed", event)
    }
    
    async fn publish_hydration_failed(&self, event: FileHydrationFailed) -> Result<()> {
        self.emit("vfs:hydration:failed", event)
    }
    
    async fn publish_storage_mounted(&self, event: StorageMounted) -> Result<()> {
        self.emit("vfs:storage:mounted", event)
    }
    
    async fn publish_storage_unmounted(&self, event: StorageUnmounted) -> Result<()> {
        self.emit("vfs:storage:unmounted", event)
    }
    
    async fn publish_transcode_started(&self, event: TranscodeStarted) -> Result<()> {
        self.emit("vfs:transcode:started", event)
    }
    
    async fn publish_transcode_progress(&self, event: TranscodeProgress) -> Result<()> {
        self.emit("vfs:transcode:progress", event)
    }
    
    async fn publish_transcode_completed(&self, event: TranscodeCompleted) -> Result<()> {
        self.emit("vfs:transcode:completed", event)
    }
    
    async fn publish_cache_eviction(&self, event: CacheEviction) -> Result<()> {
        self.emit("vfs:cache:eviction", event)
    }
}

