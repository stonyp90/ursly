//! File Operations Port - POSIX-compliant file operations interface
//!
//! This trait defines the contract for all file operations that storage adapters
//! must implement. Operations follow POSIX semantics where applicable.

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::SystemTime;

/// File entry returned from list operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    /// File name (without path)
    pub name: String,
    /// Full path
    pub path: String,
    /// File size in bytes
    pub size: u64,
    /// Is this a directory
    pub is_dir: bool,
    /// Is this a file
    pub is_file: bool,
    /// Is this a symlink
    pub is_symlink: bool,
    /// Last modified time
    pub modified: Option<SystemTime>,
    /// Created time
    pub created: Option<SystemTime>,
    /// Last accessed time
    pub accessed: Option<SystemTime>,
    /// File permissions (Unix mode)
    pub mode: Option<u32>,
    /// MIME type (if known)
    pub mime_type: Option<String>,
}

impl Default for FileEntry {
    fn default() -> Self {
        Self {
            name: String::new(),
            path: String::new(),
            size: 0,
            is_dir: false,
            is_file: true,
            is_symlink: false,
            modified: None,
            created: None,
            accessed: None,
            mode: None,
            mime_type: None,
        }
    }
}

/// File statistics (similar to POSIX stat)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStat {
    /// File size in bytes
    pub size: u64,
    /// Is directory
    pub is_dir: bool,
    /// Is regular file
    pub is_file: bool,
    /// Is symbolic link
    pub is_symlink: bool,
    /// Last modification time
    pub mtime: Option<SystemTime>,
    /// Last access time
    pub atime: Option<SystemTime>,
    /// Creation time (where supported)
    pub ctime: Option<SystemTime>,
    /// File mode (permissions)
    pub mode: u32,
    /// Number of hard links
    pub nlink: u64,
    /// User ID of owner
    pub uid: u32,
    /// Group ID of owner
    pub gid: u32,
    /// Block size for filesystem I/O
    pub blksize: u64,
    /// Number of 512B blocks allocated
    pub blocks: u64,
}

impl Default for FileStat {
    fn default() -> Self {
        Self {
            size: 0,
            is_dir: false,
            is_file: true,
            is_symlink: false,
            mtime: None,
            atime: None,
            ctime: None,
            mode: 0o644, // Default file permissions
            nlink: 1,
            uid: 0,
            gid: 0,
            blksize: 4096,
            blocks: 0,
        }
    }
}

/// Copy options for file copy operations
#[derive(Debug, Clone, Default)]
pub struct CopyOptions {
    /// Overwrite existing files
    pub overwrite: bool,
    /// Preserve file attributes (mode, times)
    pub preserve_attributes: bool,
    /// Copy directories recursively
    pub recursive: bool,
    /// Follow symlinks
    pub follow_symlinks: bool,
}

/// Move options for file move operations
#[derive(Debug, Clone, Default)]
pub struct MoveOptions {
    /// Overwrite existing files
    pub overwrite: bool,
}

/// Delete options for file delete operations
#[derive(Debug, Clone, Default)]
pub struct DeleteOptions {
    /// Delete directories recursively
    pub recursive: bool,
    /// Force deletion (ignore errors)
    pub force: bool,
}

/// POSIX-compliant file operations interface
///
/// All storage adapters must implement these operations to provide
/// a consistent file system experience across different backends.
#[async_trait]
pub trait IFileOperations: Send + Sync {
    // =========================================================================
    // POSIX Read Operations
    // =========================================================================
    
    /// List directory contents (like `ls` or `readdir`)
    ///
    /// Returns a list of file entries in the specified directory.
    /// Does not include `.` and `..` entries.
    async fn list(&self, path: &Path) -> Result<Vec<FileEntry>>;
    
    /// Get file/directory statistics (like `stat`)
    ///
    /// Returns detailed metadata about a file or directory.
    async fn stat(&self, path: &Path) -> Result<FileStat>;
    
    /// Read entire file contents (like `cat` or `read`)
    ///
    /// Returns the complete file contents as bytes.
    async fn read(&self, path: &Path) -> Result<Vec<u8>>;
    
    /// Read file contents at offset (like `pread`)
    ///
    /// Returns `len` bytes starting at `offset`.
    async fn read_range(&self, path: &Path, offset: u64, len: u64) -> Result<Vec<u8>>;
    
    // =========================================================================
    // POSIX Write Operations
    // =========================================================================
    
    /// Write data to file, creating or truncating (like `write` with O_TRUNC)
    ///
    /// Creates the file if it doesn't exist, truncates if it does.
    async fn write(&self, path: &Path, data: &[u8]) -> Result<()>;
    
    /// Append data to file (like `write` with O_APPEND)
    ///
    /// Creates the file if it doesn't exist.
    async fn append(&self, path: &Path, data: &[u8]) -> Result<()>;
    
    /// Write data at specific offset (like `pwrite`)
    ///
    /// File must exist. Does not truncate.
    async fn write_at(&self, path: &Path, offset: u64, data: &[u8]) -> Result<()>;
    
    /// Truncate file to specified length (like `truncate`)
    async fn truncate(&self, path: &Path, len: u64) -> Result<()>;
    
    // =========================================================================
    // POSIX Directory Operations
    // =========================================================================
    
    /// Create a directory (like `mkdir`)
    ///
    /// Fails if parent directory doesn't exist or directory already exists.
    async fn mkdir(&self, path: &Path) -> Result<()>;
    
    /// Create directory and all parent directories (like `mkdir -p`)
    ///
    /// Does not fail if directory already exists.
    async fn mkdir_p(&self, path: &Path) -> Result<()>;
    
    /// Remove empty directory (like `rmdir`)
    ///
    /// Fails if directory is not empty.
    async fn rmdir(&self, path: &Path) -> Result<()>;
    
    // =========================================================================
    // POSIX File Management
    // =========================================================================
    
    /// Rename/move file within same filesystem (like `rename`)
    ///
    /// Atomic operation when possible.
    async fn rename(&self, from: &Path, to: &Path) -> Result<()>;
    
    /// Copy file or directory
    ///
    /// Use `options.recursive` for directory copies.
    async fn copy(&self, from: &Path, to: &Path, options: CopyOptions) -> Result<()>;
    
    /// Move file or directory (copy + delete for cross-filesystem)
    async fn mv(&self, from: &Path, to: &Path, options: MoveOptions) -> Result<()>;
    
    /// Remove file (like `rm` or `unlink`)
    async fn rm(&self, path: &Path) -> Result<()>;
    
    /// Remove file or directory recursively (like `rm -rf`)
    ///
    /// Be careful - this is destructive!
    async fn rm_rf(&self, path: &Path) -> Result<()>;
    
    /// Create a symbolic link (like `symlink`)
    async fn symlink(&self, target: &Path, link: &Path) -> Result<()>;
    
    /// Read symbolic link target (like `readlink`)
    async fn readlink(&self, path: &Path) -> Result<String>;
    
    // =========================================================================
    // POSIX Metadata Operations
    // =========================================================================
    
    /// Check if path exists (like `access` with F_OK)
    async fn exists(&self, path: &Path) -> Result<bool>;
    
    /// Check if path is a directory
    async fn is_dir(&self, path: &Path) -> Result<bool>;
    
    /// Check if path is a regular file
    async fn is_file(&self, path: &Path) -> Result<bool>;
    
    /// Check if path is a symbolic link
    async fn is_symlink(&self, path: &Path) -> Result<bool>;
    
    /// Change file permissions (like `chmod`)
    async fn chmod(&self, path: &Path, mode: u32) -> Result<()>;
    
    /// Change file owner (like `chown`)
    ///
    /// May not be supported on all backends.
    async fn chown(&self, path: &Path, uid: u32, gid: u32) -> Result<()>;
    
    /// Update file access and modification times (like `touch` or `utimes`)
    async fn touch(&self, path: &Path) -> Result<()>;
    
    /// Set specific access and modification times
    async fn set_times(&self, path: &Path, atime: Option<SystemTime>, mtime: Option<SystemTime>) -> Result<()>;
    
    // =========================================================================
    // Extended Operations (beyond POSIX)
    // =========================================================================
    
    /// Get file size without reading the file
    async fn file_size(&self, path: &Path) -> Result<u64>;
    
    /// Get available space on the filesystem
    async fn available_space(&self) -> Result<u64>;
    
    /// Get total space on the filesystem
    async fn total_space(&self) -> Result<u64>;
    
    /// Check if storage is read-only
    fn is_read_only(&self) -> bool;
    
    /// Get the root path for this storage
    fn root_path(&self) -> &Path;
}

/// Convenience trait for common file operation patterns
pub trait FileOperationsExt: IFileOperations {
    /// Read file as UTF-8 string
    fn read_string<'a>(&'a self, path: &'a Path) -> impl std::future::Future<Output = Result<String>> + Send + 'a
    where
        Self: Sync,
    {
        async move {
            let bytes = self.read(path).await?;
            String::from_utf8(bytes).map_err(|e| anyhow::anyhow!("Invalid UTF-8: {}", e))
        }
    }
    
    /// Write string to file
    fn write_string<'a>(&'a self, path: &'a Path, content: &'a str) -> impl std::future::Future<Output = Result<()>> + Send + 'a
    where
        Self: Sync,
    {
        async move {
            self.write(path, content.as_bytes()).await
        }
    }
}

// Auto-implement FileOperationsExt for all IFileOperations implementors
impl<T: IFileOperations> FileOperationsExt for T {}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_file_entry_default() {
        let entry = FileEntry::default();
        assert!(entry.is_file);
        assert!(!entry.is_dir);
        assert_eq!(entry.size, 0);
    }
    
    #[test]
    fn test_file_stat_default() {
        let stat = FileStat::default();
        assert!(stat.is_file);
        assert!(!stat.is_dir);
        assert_eq!(stat.mode, 0o644);
    }
    
    #[test]
    fn test_copy_options_default() {
        let opts = CopyOptions::default();
        assert!(!opts.overwrite);
        assert!(!opts.recursive);
    }
}



