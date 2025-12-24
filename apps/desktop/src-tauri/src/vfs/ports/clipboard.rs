//! Clipboard Port - Interface for file clipboard operations
//!
//! This module defines the contract for clipboard operations that enable
//! seamless copy/paste between native filesystem and VFS.

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Clipboard operation type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClipboardOperation {
    /// Copy files (preserve source)
    Copy,
    /// Cut files (delete source after paste)
    Cut,
}

/// Source of clipboard content
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClipboardSource {
    /// Files from native OS filesystem (Finder, Explorer, etc.)
    Native,
    /// Files from VFS with source ID
    Vfs { source_id: String },
}

/// Clipboard content for file operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardContent {
    /// Type of operation (copy or cut)
    pub operation: ClipboardOperation,
    
    /// Source of the files
    pub source: ClipboardSource,
    
    /// List of file/folder paths
    pub paths: Vec<PathBuf>,
    
    /// Timestamp when copied
    pub timestamp: u64,
}

impl ClipboardContent {
    /// Create new clipboard content for copy operation
    pub fn copy(source: ClipboardSource, paths: Vec<PathBuf>) -> Self {
        Self {
            operation: ClipboardOperation::Copy,
            source,
            paths,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }
    }
    
    /// Create new clipboard content for cut operation
    pub fn cut(source: ClipboardSource, paths: Vec<PathBuf>) -> Self {
        Self {
            operation: ClipboardOperation::Cut,
            source,
            paths,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }
    }
    
    /// Check if clipboard content is from VFS
    pub fn is_vfs(&self) -> bool {
        matches!(self.source, ClipboardSource::Vfs { .. })
    }
    
    /// Check if clipboard content is from native filesystem
    pub fn is_native(&self) -> bool {
        matches!(self.source, ClipboardSource::Native)
    }
    
    /// Check if this is a cut operation
    pub fn is_cut(&self) -> bool {
        self.operation == ClipboardOperation::Cut
    }
}

/// Result of a paste operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasteResult {
    /// Number of files successfully pasted
    pub files_pasted: usize,
    
    /// Number of files that failed
    pub files_failed: usize,
    
    /// Paths of successfully pasted files
    pub pasted_paths: Vec<PathBuf>,
    
    /// Errors encountered
    pub errors: Vec<String>,
}

impl PasteResult {
    pub fn success(pasted_paths: Vec<PathBuf>) -> Self {
        Self {
            files_pasted: pasted_paths.len(),
            files_failed: 0,
            pasted_paths,
            errors: Vec::new(),
        }
    }
    
    pub fn partial(pasted_paths: Vec<PathBuf>, errors: Vec<String>) -> Self {
        Self {
            files_pasted: pasted_paths.len(),
            files_failed: errors.len(),
            pasted_paths,
            errors,
        }
    }
}

/// Clipboard service interface for file operations
#[async_trait]
pub trait IClipboardService: Send + Sync {
    /// Copy files to clipboard (from VFS or native)
    async fn copy_files(&self, source: ClipboardSource, paths: Vec<PathBuf>) -> Result<()>;
    
    /// Cut files to clipboard (from VFS or native)
    async fn cut_files(&self, source: ClipboardSource, paths: Vec<PathBuf>) -> Result<()>;
    
    /// Get current clipboard content
    async fn get_clipboard(&self) -> Result<Option<ClipboardContent>>;
    
    /// Clear clipboard
    async fn clear_clipboard(&self) -> Result<()>;
    
    /// Check if clipboard has file content
    async fn has_files(&self) -> Result<bool>;
    
    /// Paste files to a destination
    /// - If destination is VFS, provide source_id
    /// - If destination is native, provide absolute path
    async fn paste_to_vfs(
        &self,
        dest_source_id: &str,
        dest_path: &std::path::Path,
    ) -> Result<PasteResult>;
    
    /// Paste files to native filesystem
    async fn paste_to_native(&self, dest_path: &std::path::Path) -> Result<PasteResult>;
    
    /// Read files from OS clipboard (Finder/Explorer copy)
    async fn read_native_clipboard(&self) -> Result<Option<Vec<PathBuf>>>;
    
    /// Write files to OS clipboard (so Finder/Explorer can paste)
    async fn write_native_clipboard(&self, paths: &[PathBuf]) -> Result<()>;
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_clipboard_content_copy() {
        let content = ClipboardContent::copy(
            ClipboardSource::Native,
            vec![PathBuf::from("/Users/test/file.txt")],
        );
        
        assert_eq!(content.operation, ClipboardOperation::Copy);
        assert!(content.is_native());
        assert!(!content.is_cut());
    }
    
    #[test]
    fn test_clipboard_content_cut() {
        let content = ClipboardContent::cut(
            ClipboardSource::Vfs { source_id: "s3-bucket".to_string() },
            vec![PathBuf::from("/videos/clip.mp4")],
        );
        
        assert_eq!(content.operation, ClipboardOperation::Cut);
        assert!(content.is_vfs());
        assert!(content.is_cut());
    }
    
    #[test]
    fn test_paste_result_success() {
        let result = PasteResult::success(vec![
            PathBuf::from("/dest/file1.txt"),
            PathBuf::from("/dest/file2.txt"),
        ]);
        
        assert_eq!(result.files_pasted, 2);
        assert_eq!(result.files_failed, 0);
        assert!(result.errors.is_empty());
    }
}



