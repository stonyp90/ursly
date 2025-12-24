//! Domain Events - Events that occur within the VFS domain

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::SystemTime;

use super::value_objects::StorageTier;

/// Base trait for all VFS domain events
pub trait VfsEvent: Send + Sync {
    fn event_type(&self) -> &'static str;
    fn timestamp(&self) -> SystemTime;
}

/// File hydration started event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileHydrationStarted {
    pub file_path: PathBuf,
    pub source_tier: StorageTier,
    pub file_size: u64,
    pub timestamp: SystemTime,
}

impl VfsEvent for FileHydrationStarted {
    fn event_type(&self) -> &'static str {
        "file.hydration.started"
    }
    
    fn timestamp(&self) -> SystemTime {
        self.timestamp
    }
}

/// File hydration completed event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileHydrationCompleted {
    pub file_path: PathBuf,
    pub source_tier: StorageTier,
    pub target_tier: StorageTier,
    pub bytes_transferred: u64,
    pub duration_ms: u64,
    pub timestamp: SystemTime,
}

impl VfsEvent for FileHydrationCompleted {
    fn event_type(&self) -> &'static str {
        "file.hydration.completed"
    }
    
    fn timestamp(&self) -> SystemTime {
        self.timestamp
    }
}

/// File hydration failed event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileHydrationFailed {
    pub file_path: PathBuf,
    pub error: String,
    pub timestamp: SystemTime,
}

impl VfsEvent for FileHydrationFailed {
    fn event_type(&self) -> &'static str {
        "file.hydration.failed"
    }
    
    fn timestamp(&self) -> SystemTime {
        self.timestamp
    }
}

/// Storage source mounted event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageMounted {
    pub source_id: String,
    pub source_name: String,
    pub mount_point: PathBuf,
    pub timestamp: SystemTime,
}

impl VfsEvent for StorageMounted {
    fn event_type(&self) -> &'static str {
        "storage.mounted"
    }
    
    fn timestamp(&self) -> SystemTime {
        self.timestamp
    }
}

/// Storage source unmounted event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageUnmounted {
    pub source_id: String,
    pub timestamp: SystemTime,
}

impl VfsEvent for StorageUnmounted {
    fn event_type(&self) -> &'static str {
        "storage.unmounted"
    }
    
    fn timestamp(&self) -> SystemTime {
        self.timestamp
    }
}

/// Transcode started event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscodeStarted {
    pub file_path: PathBuf,
    pub output_format: String,
    pub timestamp: SystemTime,
}

impl VfsEvent for TranscodeStarted {
    fn event_type(&self) -> &'static str {
        "transcode.started"
    }
    
    fn timestamp(&self) -> SystemTime {
        self.timestamp
    }
}

/// Transcode progress event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscodeProgress {
    pub file_path: PathBuf,
    pub progress: u8,
    pub timestamp: SystemTime,
}

impl VfsEvent for TranscodeProgress {
    fn event_type(&self) -> &'static str {
        "transcode.progress"
    }
    
    fn timestamp(&self) -> SystemTime {
        self.timestamp
    }
}

/// Transcode completed event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscodeCompleted {
    pub file_path: PathBuf,
    pub output_path: PathBuf,
    pub output_format: String,
    pub duration_ms: u64,
    pub timestamp: SystemTime,
}

impl VfsEvent for TranscodeCompleted {
    fn event_type(&self) -> &'static str {
        "transcode.completed"
    }
    
    fn timestamp(&self) -> SystemTime {
        self.timestamp
    }
}

/// Cache eviction event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEviction {
    pub evicted_path: PathBuf,
    pub freed_bytes: u64,
    pub reason: EvictionReason,
    pub timestamp: SystemTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EvictionReason {
    CacheFull,
    Expired,
    Manual,
}

impl VfsEvent for CacheEviction {
    fn event_type(&self) -> &'static str {
        "cache.eviction"
    }
    
    fn timestamp(&self) -> SystemTime {
        self.timestamp
    }
}



