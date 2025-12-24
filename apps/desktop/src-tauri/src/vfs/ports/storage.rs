//! Storage Port - Interface for storage adapters

use anyhow::Result;
use async_trait::async_trait;
use std::path::Path;

use crate::vfs::domain::{VirtualFile, StorageSourceType};

/// Storage adapter trait - Port for all storage backends
///
/// This trait defines the contract that all storage adapters must implement.
/// Following the Ports & Adapters pattern, the application core depends on
/// this trait, not on concrete implementations.
#[async_trait]
pub trait StorageAdapter: Send + Sync {
    /// Get the storage type
    fn storage_type(&self) -> StorageSourceType;
    
    /// Get adapter name for display
    fn name(&self) -> &str;
    
    /// Test connection to the storage backend
    async fn test_connection(&self) -> Result<bool>;
    
    /// List files in a directory
    async fn list_files(&self, path: &Path) -> Result<Vec<VirtualFile>>;
    
    /// Read file contents
    async fn read_file(&self, path: &Path) -> Result<Vec<u8>>;
    
    /// Read file contents with range (for partial reads)
    async fn read_file_range(&self, path: &Path, offset: u64, length: u64) -> Result<Vec<u8>>;
    
    /// Write file contents
    async fn write_file(&self, path: &Path, data: &[u8]) -> Result<()>;
    
    /// Get file metadata
    async fn get_metadata(&self, path: &Path) -> Result<VirtualFile>;
    
    /// Check if file exists
    async fn exists(&self, path: &Path) -> Result<bool>;
    
    /// Delete file
    async fn delete(&self, path: &Path) -> Result<()>;
    
    /// Create directory
    async fn create_dir(&self, path: &Path) -> Result<()>;
    
    /// Get file size without downloading
    async fn file_size(&self, path: &Path) -> Result<u64>;
}

/// Factory for creating storage adapters
pub trait StorageAdapterFactory: Send + Sync {
    fn create_adapter(&self, config: &StorageAdapterConfig) -> Result<Box<dyn StorageAdapter>>;
}

/// Configuration for storage adapters
#[derive(Debug, Clone)]
pub struct StorageAdapterConfig {
    pub adapter_type: StorageSourceType,
    pub path_or_bucket: String,
    pub region: Option<String>,
    pub endpoint: Option<String>,
    pub access_key: Option<String>,
    pub secret_key: Option<String>,
}

impl Default for StorageAdapterConfig {
    fn default() -> Self {
        Self {
            adapter_type: StorageSourceType::Local,
            path_or_bucket: String::new(),
            region: None,
            endpoint: None,
            access_key: None,
            secret_key: None,
        }
    }
}



