//! Cross-Storage Port - Interface for moving files between storage backends
//!
//! This module defines the contract for copying and moving files
//! between different storage sources (e.g., local to S3, S3 to FSxN).

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Options for cross-storage operations
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CrossStorageOptions {
    /// Overwrite existing files at destination
    pub overwrite: bool,
    
    /// Delete source after successful copy (move operation)
    pub delete_source: bool,
    
    /// Copy recursively for directories
    pub recursive: bool,
    
    /// Preserve metadata (tags, favorites, etc.)
    pub preserve_metadata: bool,
}

impl CrossStorageOptions {
    /// Options for a copy operation
    pub fn copy() -> Self {
        Self {
            overwrite: false,
            delete_source: false,
            recursive: true,
            preserve_metadata: true,
        }
    }
    
    /// Options for a move operation
    pub fn r#move() -> Self {
        Self {
            overwrite: false,
            delete_source: true,
            recursive: true,
            preserve_metadata: true,
        }
    }
}

/// Result of a cross-storage operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossStorageResult {
    /// Number of files successfully transferred
    pub files_transferred: usize,
    
    /// Number of files that failed
    pub files_failed: usize,
    
    /// Total bytes transferred
    pub bytes_transferred: u64,
    
    /// Destination paths of transferred files
    pub transferred_paths: Vec<PathBuf>,
    
    /// Errors encountered
    pub errors: Vec<String>,
    
    /// Source was deleted (for move operations)
    pub source_deleted: bool,
}

impl CrossStorageResult {
    pub fn success(transferred_paths: Vec<PathBuf>, bytes: u64) -> Self {
        Self {
            files_transferred: transferred_paths.len(),
            files_failed: 0,
            bytes_transferred: bytes,
            transferred_paths,
            errors: Vec::new(),
            source_deleted: false,
        }
    }
    
    pub fn with_source_deleted(mut self) -> Self {
        self.source_deleted = true;
        self
    }
}

/// Progress callback for cross-storage operations
pub type ProgressCallback = Box<dyn Fn(CrossStorageProgress) + Send + Sync>;

/// Progress update during transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossStorageProgress {
    /// Current file being transferred
    pub current_file: String,
    
    /// Files completed
    pub files_completed: usize,
    
    /// Total files to transfer
    pub total_files: usize,
    
    /// Bytes transferred so far
    pub bytes_transferred: u64,
    
    /// Total bytes to transfer
    pub total_bytes: u64,
    
    /// Progress percentage (0-100)
    pub percent: u8,
}

/// Cross-storage service interface
#[async_trait]
pub trait ICrossStorageService: Send + Sync {
    /// Copy files from one storage source to another
    async fn copy_between_sources(
        &self,
        from_source_id: &str,
        from_paths: &[PathBuf],
        to_source_id: &str,
        to_path: &std::path::Path,
        options: CrossStorageOptions,
    ) -> Result<CrossStorageResult>;
    
    /// Move files from one storage source to another (copy + delete source)
    async fn move_between_sources(
        &self,
        from_source_id: &str,
        from_paths: &[PathBuf],
        to_source_id: &str,
        to_path: &std::path::Path,
        options: CrossStorageOptions,
    ) -> Result<CrossStorageResult>;
    
    /// Check if a cross-storage operation is possible
    async fn can_transfer(
        &self,
        from_source_id: &str,
        to_source_id: &str,
    ) -> Result<bool>;
    
    /// Estimate transfer time/size
    async fn estimate_transfer(
        &self,
        from_source_id: &str,
        from_paths: &[PathBuf],
    ) -> Result<TransferEstimate>;
}

/// Transfer estimate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferEstimate {
    /// Total files to transfer
    pub total_files: usize,
    
    /// Total bytes to transfer
    pub total_bytes: u64,
    
    /// Estimated time in seconds
    pub estimated_seconds: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_copy_options() {
        let opts = CrossStorageOptions::copy();
        assert!(!opts.delete_source);
        assert!(opts.recursive);
        assert!(opts.preserve_metadata);
    }
    
    #[test]
    fn test_move_options() {
        let opts = CrossStorageOptions::r#move();
        assert!(opts.delete_source);
        assert!(opts.recursive);
    }
    
    #[test]
    fn test_result_success() {
        let result = CrossStorageResult::success(
            vec![PathBuf::from("/dest/file.txt")],
            1024,
        );
        assert_eq!(result.files_transferred, 1);
        assert_eq!(result.bytes_transferred, 1024);
        assert!(!result.source_deleted);
    }
}

