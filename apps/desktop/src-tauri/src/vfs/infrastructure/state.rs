//! VFS State Management for Tauri

use std::sync::Arc;
use parking_lot::RwLock;
use tokio::sync::OnceCell;

use crate::vfs::application::VfsService;

/// Global VFS state for Tauri
pub struct VfsState {
    service: OnceCell<Arc<VfsService>>,
    initialized: RwLock<bool>,
}

impl VfsState {
    pub fn new() -> Self {
        Self {
            service: OnceCell::new(),
            initialized: RwLock::new(false),
        }
    }
    
    /// Initialize the VFS service
    pub async fn init(&self) -> anyhow::Result<()> {
        if *self.initialized.read() {
            return Ok(());
        }
        
        let service = VfsService::new().await?;
        self.service.set(Arc::new(service))
            .map_err(|_| anyhow::anyhow!("VFS service already initialized"))?;
        
        *self.initialized.write() = true;
        
        Ok(())
    }
    
    /// Get the VFS service
    pub fn service(&self) -> Option<Arc<VfsService>> {
        self.service.get().cloned()
    }
    
    /// Check if initialized
    pub fn is_initialized(&self) -> bool {
        *self.initialized.read()
    }
}

impl Default for VfsState {
    fn default() -> Self {
        Self::new()
    }
}



