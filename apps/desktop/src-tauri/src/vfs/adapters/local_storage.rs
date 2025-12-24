//! Local Storage Adapter - Implements StorageAdapter and IFileOperations for local filesystem

use anyhow::{Context, Result};
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use tracing::{debug, error, info, warn};

use crate::vfs::domain::{VirtualFile, StorageSourceType, TierStatus, StorageTier};
use crate::vfs::ports::StorageAdapter;
use crate::vfs::ports::{IFileOperations, FileEntry, FileStat, CopyOptions, MoveOptions};

/// Local filesystem storage adapter
pub struct LocalStorageAdapter {
    /// Base path for this adapter
    base_path: PathBuf,
    
    /// Display name
    name: String,
}

impl LocalStorageAdapter {
    pub fn new(base_path: PathBuf, name: String) -> Self {
        Self { base_path, name }
    }
    
    /// Resolve a VFS path to an actual filesystem path
    /// Handles cross-platform path separators (Unix / and Windows \)
    fn resolve_path(&self, path: &Path) -> PathBuf {
        // If already an absolute path starting with our base, use it directly
        if path.is_absolute() && path.starts_with(&self.base_path) {
            return path.to_path_buf();
        }
        
        // Convert path to string for normalization
        let path_str = path.to_string_lossy();
        
        // Normalize: strip leading slashes (Unix) or backslashes (Windows)
        let normalized = path_str
            .trim_start_matches('/')
            .trim_start_matches('\\');
        
        // Handle empty path (root of source)
        if normalized.is_empty() {
            return self.base_path.clone();
        }
        
        // Join with base path - PathBuf::join handles platform separators
        self.base_path.join(normalized)
    }
}

#[async_trait]
impl StorageAdapter for LocalStorageAdapter {
    fn storage_type(&self) -> StorageSourceType {
        StorageSourceType::Local
    }
    
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn test_connection(&self) -> Result<bool> {
        Ok(self.base_path.exists() && self.base_path.is_dir())
    }
    
    async fn list_files(&self, path: &Path) -> Result<Vec<VirtualFile>> {
        let full_path = self.resolve_path(path);
        debug!("Listing files at: {:?}", full_path);
        
        let mut files = Vec::new();
        let mut entries = fs::read_dir(&full_path)
            .await
            .with_context(|| format!("Failed to read directory: {:?}", full_path))?;
        
        while let Some(entry) = entries.next_entry().await? {
            let metadata = entry.metadata().await?;
            let name = entry.file_name().to_string_lossy().to_string();
            let file_path = path.join(&name);
            
            let mut vfile = VirtualFile::new(
                name,
                file_path,
                metadata.len(),
                metadata.is_dir(),
            );
            
            // Local files are always "hot" (immediately accessible)
            vfile.tier_status = TierStatus {
                current_tier: StorageTier::Hot,
                is_cached: true,
                can_warm: false,
                retrieval_time_estimate: Some(0),
            };
            
            vfile.transcodable = vfile.can_transcode();
            
            if let Ok(modified) = metadata.modified() {
                vfile.last_modified = modified;
            }
            
            files.push(vfile);
        }
        
        // Sort: directories first, then by name
        files.sort_by(|a, b| {
            match (a.is_directory, b.is_directory) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });
        
        Ok(files)
    }
    
    async fn read_file(&self, path: &Path) -> Result<Vec<u8>> {
        let full_path = self.resolve_path(path);
        debug!("Reading file: {:?}", full_path);
        
        fs::read(&full_path)
            .await
            .with_context(|| format!("Failed to read file: {:?}", full_path))
    }
    
    async fn read_file_range(&self, path: &Path, offset: u64, length: u64) -> Result<Vec<u8>> {
        use tokio::io::{AsyncReadExt, AsyncSeekExt};
        
        let full_path = self.resolve_path(path);
        let mut file = tokio::fs::File::open(&full_path)
            .await
            .with_context(|| format!("Failed to open file: {:?}", full_path))?;
        
        file.seek(std::io::SeekFrom::Start(offset)).await?;
        
        let mut buffer = vec![0u8; length as usize];
        let bytes_read = file.read(&mut buffer).await?;
        buffer.truncate(bytes_read);
        
        Ok(buffer)
    }
    
    async fn write_file(&self, path: &Path, data: &[u8]) -> Result<()> {
        let full_path = self.resolve_path(path);
        debug!("Writing file: {:?}", full_path);
        
        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        fs::write(&full_path, data)
            .await
            .with_context(|| format!("Failed to write file: {:?}", full_path))
    }
    
    async fn get_metadata(&self, path: &Path) -> Result<VirtualFile> {
        let full_path = self.resolve_path(path);
        let metadata = fs::metadata(&full_path)
            .await
            .with_context(|| format!("Failed to get metadata: {:?}", full_path))?;
        
        let name = full_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        
        let mut vfile = VirtualFile::new(
            name,
            path.to_path_buf(),
            metadata.len(),
            metadata.is_dir(),
        );
        
        vfile.tier_status = TierStatus {
            current_tier: StorageTier::Hot,
            is_cached: true,
            can_warm: false,
            retrieval_time_estimate: Some(0),
        };
        
        if let Ok(modified) = metadata.modified() {
            vfile.last_modified = modified;
        }
        
        Ok(vfile)
    }
    
    async fn exists(&self, path: &Path) -> Result<bool> {
        let full_path = self.resolve_path(path);
        Ok(full_path.exists())
    }
    
    async fn delete(&self, path: &Path) -> Result<()> {
        let full_path = self.resolve_path(path);
        
        if full_path.is_dir() {
            fs::remove_dir_all(&full_path).await?;
        } else {
            fs::remove_file(&full_path).await?;
        }
        
        Ok(())
    }
    
    async fn create_dir(&self, path: &Path) -> Result<()> {
        let full_path = self.resolve_path(path);
        fs::create_dir_all(&full_path).await?;
        Ok(())
    }
    
    async fn file_size(&self, path: &Path) -> Result<u64> {
        let full_path = self.resolve_path(path);
        let metadata = fs::metadata(&full_path).await?;
        Ok(metadata.len())
    }
}

// =============================================================================
// IFileOperations Implementation - Full POSIX-compliant file operations
// =============================================================================

#[async_trait]
impl IFileOperations for LocalStorageAdapter {
    // =========================================================================
    // POSIX Read Operations
    // =========================================================================
    
    async fn list(&self, path: &Path) -> Result<Vec<FileEntry>> {
        let full_path = self.resolve_path(path);
        debug!("Listing directory: {:?}", full_path);
        
        let mut entries = Vec::new();
        let mut dir = fs::read_dir(&full_path)
            .await
            .with_context(|| format!("Failed to read directory: {:?}", full_path))?;
        
        while let Some(entry) = dir.next_entry().await? {
            let metadata = entry.metadata().await?;
            let name = entry.file_name().to_string_lossy().to_string();
            let file_path = path.join(&name);
            
            let file_entry = FileEntry {
                name,
                path: file_path.to_string_lossy().to_string(),
                size: metadata.len(),
                is_dir: metadata.is_dir(),
                is_file: metadata.is_file(),
                is_symlink: metadata.file_type().is_symlink(),
                modified: metadata.modified().ok(),
                created: metadata.created().ok(),
                accessed: metadata.accessed().ok(),
                mode: self.get_mode(&metadata),
                mime_type: None, // Could be determined from extension
            };
            
            entries.push(file_entry);
        }
        
        // Sort: directories first, then by name
        entries.sort_by(|a, b| {
            match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });
        
        Ok(entries)
    }
    
    async fn stat(&self, path: &Path) -> Result<FileStat> {
        let full_path = self.resolve_path(path);
        let metadata = fs::metadata(&full_path)
            .await
            .with_context(|| format!("Failed to stat: {:?}", full_path))?;
        
        Ok(FileStat {
            size: metadata.len(),
            is_dir: metadata.is_dir(),
            is_file: metadata.is_file(),
            is_symlink: metadata.file_type().is_symlink(),
            mtime: metadata.modified().ok(),
            atime: metadata.accessed().ok(),
            ctime: metadata.created().ok(),
            mode: self.get_mode(&metadata).unwrap_or(0o644),
            nlink: 1, // Not easily available on all platforms
            uid: self.get_uid(&metadata),
            gid: self.get_gid(&metadata),
            blksize: 4096,
            blocks: (metadata.len() + 511) / 512,
        })
    }
    
    async fn read(&self, path: &Path) -> Result<Vec<u8>> {
        let full_path = self.resolve_path(path);
        debug!("Reading file: {:?}", full_path);
        
        fs::read(&full_path)
            .await
            .with_context(|| format!("Failed to read file: {:?}", full_path))
    }
    
    async fn read_range(&self, path: &Path, offset: u64, len: u64) -> Result<Vec<u8>> {
        let full_path = self.resolve_path(path);
        let mut file = fs::File::open(&full_path)
            .await
            .with_context(|| format!("Failed to open file: {:?}", full_path))?;
        
        file.seek(std::io::SeekFrom::Start(offset)).await?;
        
        let mut buffer = vec![0u8; len as usize];
        let bytes_read = file.read(&mut buffer).await?;
        buffer.truncate(bytes_read);
        
        Ok(buffer)
    }
    
    // =========================================================================
    // POSIX Write Operations
    // =========================================================================
    
    async fn write(&self, path: &Path, data: &[u8]) -> Result<()> {
        let full_path = self.resolve_path(path);
        debug!("Writing file: {:?}", full_path);
        
        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        fs::write(&full_path, data)
            .await
            .with_context(|| format!("Failed to write file: {:?}", full_path))
    }
    
    async fn append(&self, path: &Path, data: &[u8]) -> Result<()> {
        let full_path = self.resolve_path(path);
        debug!("Appending to file: {:?}", full_path);
        
        // Ensure parent directory exists
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&full_path)
            .await
            .with_context(|| format!("Failed to open file for append: {:?}", full_path))?;
        
        file.write_all(data).await?;
        Ok(())
    }
    
    async fn write_at(&self, path: &Path, offset: u64, data: &[u8]) -> Result<()> {
        let full_path = self.resolve_path(path);
        debug!("Writing at offset {} to file: {:?}", offset, full_path);
        
        let mut file = fs::OpenOptions::new()
            .write(true)
            .open(&full_path)
            .await
            .with_context(|| format!("Failed to open file for write: {:?}", full_path))?;
        
        file.seek(std::io::SeekFrom::Start(offset)).await?;
        file.write_all(data).await?;
        
        Ok(())
    }
    
    async fn truncate(&self, path: &Path, len: u64) -> Result<()> {
        let full_path = self.resolve_path(path);
        debug!("Truncating file to {} bytes: {:?}", len, full_path);
        
        let file = fs::File::open(&full_path)
            .await
            .with_context(|| format!("Failed to open file: {:?}", full_path))?;
        
        file.set_len(len).await?;
        Ok(())
    }
    
    // =========================================================================
    // POSIX Directory Operations
    // =========================================================================
    
    async fn mkdir(&self, path: &Path) -> Result<()> {
        let full_path = self.resolve_path(path);
        debug!("Creating directory: {:?}", full_path);
        
        fs::create_dir(&full_path)
            .await
            .with_context(|| format!("Failed to create directory: {:?}", full_path))
    }
    
    async fn mkdir_p(&self, path: &Path) -> Result<()> {
        let full_path = self.resolve_path(path);
        debug!("Creating directory recursively: {:?}", full_path);
        
        fs::create_dir_all(&full_path)
            .await
            .with_context(|| format!("Failed to create directory: {:?}", full_path))
    }
    
    async fn rmdir(&self, path: &Path) -> Result<()> {
        let full_path = self.resolve_path(path);
        debug!("Removing empty directory: {:?}", full_path);
        
        fs::remove_dir(&full_path)
            .await
            .with_context(|| format!("Failed to remove directory: {:?}", full_path))
    }
    
    // =========================================================================
    // POSIX File Management
    // =========================================================================
    
    async fn rename(&self, from: &Path, to: &Path) -> Result<()> {
        let from_path = self.resolve_path(from);
        let to_path = self.resolve_path(to);
        debug!("Renaming {:?} to {:?}", from_path, to_path);
        
        // Ensure parent directory of destination exists
        if let Some(parent) = to_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        fs::rename(&from_path, &to_path)
            .await
            .with_context(|| format!("Failed to rename {:?} to {:?}", from_path, to_path))
    }
    
    async fn copy(&self, from: &Path, to: &Path, options: CopyOptions) -> Result<()> {
        let from_path = self.resolve_path(from);
        let to_path = self.resolve_path(to);
        debug!("Copying {:?} to {:?}", from_path, to_path);
        
        // Check if destination exists
        if to_path.exists() && !options.overwrite {
            return Err(anyhow::anyhow!("Destination already exists: {:?}", to_path));
        }
        
        // Ensure parent directory exists
        if let Some(parent) = to_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        let metadata = fs::metadata(&from_path).await?;
        
        if metadata.is_dir() {
            if !options.recursive {
                return Err(anyhow::anyhow!("Cannot copy directory without recursive option"));
            }
            self.copy_dir_recursive(&from_path, &to_path, &options).await?;
        } else {
            fs::copy(&from_path, &to_path).await?;
            
            if options.preserve_attributes {
                self.preserve_attributes(&from_path, &to_path).await?;
            }
        }
        
        Ok(())
    }
    
    async fn mv(&self, from: &Path, to: &Path, options: MoveOptions) -> Result<()> {
        let from_path = self.resolve_path(from);
        let to_path = self.resolve_path(to);
        debug!("Moving {:?} to {:?}", from_path, to_path);
        
        // Check if destination exists
        if to_path.exists() && !options.overwrite {
            return Err(anyhow::anyhow!("Destination already exists: {:?}", to_path));
        }
        
        // Ensure parent directory exists
        if let Some(parent) = to_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        // Try rename first (atomic within same filesystem)
        match fs::rename(&from_path, &to_path).await {
            Ok(()) => Ok(()),
            Err(_) => {
                // Cross-filesystem move: copy then delete
                let copy_opts = CopyOptions {
                    overwrite: options.overwrite,
                    preserve_attributes: true,
                    recursive: true,
                    follow_symlinks: false,
                };
                self.copy(from, to, copy_opts).await?;
                self.rm_rf(from).await?;
                Ok(())
            }
        }
    }
    
    async fn rm(&self, path: &Path) -> Result<()> {
        let full_path = self.resolve_path(path);
        debug!("Removing file: {:?}", full_path);
        
        fs::remove_file(&full_path)
            .await
            .with_context(|| format!("Failed to remove file: {:?}", full_path))
    }
    
    async fn rm_rf(&self, path: &Path) -> Result<()> {
        let full_path = self.resolve_path(path);
        info!("rm_rf: resolved path {:?} to {:?}", path, full_path);
        
        if !full_path.exists() {
            warn!("rm_rf: Path does not exist, nothing to delete: {:?}", full_path);
            return Ok(());
        }
        
        let metadata = fs::metadata(&full_path).await?;
        
        if metadata.is_dir() {
            info!("rm_rf: Removing directory recursively: {:?}", full_path);
            fs::remove_dir_all(&full_path)
                .await
                .with_context(|| format!("Failed to remove directory: {:?}", full_path))?;
            info!("rm_rf: Successfully removed directory: {:?}", full_path);
            Ok(())
        } else {
            info!("rm_rf: Removing file: {:?}", full_path);
            fs::remove_file(&full_path)
                .await
                .with_context(|| format!("Failed to remove file: {:?}", full_path))?;
            info!("rm_rf: Successfully removed file: {:?}", full_path);
            Ok(())
        }
    }
    
    async fn symlink(&self, target: &Path, link: &Path) -> Result<()> {
        let link_path = self.resolve_path(link);
        debug!("Creating symlink {:?} -> {:?}", link_path, target);
        
        #[cfg(unix)]
        {
            tokio::fs::symlink(target, &link_path)
                .await
                .with_context(|| format!("Failed to create symlink: {:?}", link_path))
        }
        
        #[cfg(windows)]
        {
            // Windows requires different calls for file vs directory symlinks
            if target.is_dir() {
                tokio::fs::symlink_dir(target, &link_path)
                    .await
                    .with_context(|| format!("Failed to create symlink: {:?}", link_path))
            } else {
                tokio::fs::symlink_file(target, &link_path)
                    .await
                    .with_context(|| format!("Failed to create symlink: {:?}", link_path))
            }
        }
    }
    
    async fn readlink(&self, path: &Path) -> Result<String> {
        let full_path = self.resolve_path(path);
        debug!("Reading symlink: {:?}", full_path);
        
        let target = fs::read_link(&full_path)
            .await
            .with_context(|| format!("Failed to read symlink: {:?}", full_path))?;
        
        Ok(target.to_string_lossy().to_string())
    }
    
    // =========================================================================
    // POSIX Metadata Operations
    // =========================================================================
    
    async fn exists(&self, path: &Path) -> Result<bool> {
        let full_path = self.resolve_path(path);
        Ok(full_path.exists())
    }
    
    async fn is_dir(&self, path: &Path) -> Result<bool> {
        let full_path = self.resolve_path(path);
        Ok(full_path.is_dir())
    }
    
    async fn is_file(&self, path: &Path) -> Result<bool> {
        let full_path = self.resolve_path(path);
        Ok(full_path.is_file())
    }
    
    async fn is_symlink(&self, path: &Path) -> Result<bool> {
        let full_path = self.resolve_path(path);
        let metadata = fs::symlink_metadata(&full_path).await?;
        Ok(metadata.file_type().is_symlink())
    }
    
    async fn chmod(&self, path: &Path, mode: u32) -> Result<()> {
        let full_path = self.resolve_path(path);
        debug!("Changing mode of {:?} to {:o}", full_path, mode);
        
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let permissions = std::fs::Permissions::from_mode(mode);
            fs::set_permissions(&full_path, permissions)
                .await
                .with_context(|| format!("Failed to chmod: {:?}", full_path))
        }
        
        #[cfg(not(unix))]
        {
            warn!("chmod not supported on this platform");
            Ok(())
        }
    }
    
    async fn chown(&self, path: &Path, uid: u32, gid: u32) -> Result<()> {
        let full_path = self.resolve_path(path);
        debug!("Changing owner of {:?} to {}:{}", full_path, uid, gid);
        
        #[cfg(unix)]
        {
            use std::os::unix::fs::chown;
            // chown is blocking, so we use spawn_blocking
            let path_clone = full_path.clone();
            tokio::task::spawn_blocking(move || {
                chown(&path_clone, Some(uid), Some(gid))
            })
            .await?
            .with_context(|| format!("Failed to chown: {:?}", full_path))
        }
        
        #[cfg(not(unix))]
        {
            warn!("chown not supported on this platform");
            Ok(())
        }
    }
    
    async fn touch(&self, path: &Path) -> Result<()> {
        let full_path = self.resolve_path(path);
        debug!("Touching file: {:?}", full_path);
        
        if full_path.exists() {
            // Update modification time
            let now = filetime::FileTime::now();
            filetime::set_file_mtime(&full_path, now)?;
        } else {
            // Create empty file
            if let Some(parent) = full_path.parent() {
                fs::create_dir_all(parent).await?;
            }
            fs::write(&full_path, b"").await?;
        }
        
        Ok(())
    }
    
    async fn set_times(&self, path: &Path, atime: Option<SystemTime>, mtime: Option<SystemTime>) -> Result<()> {
        let full_path = self.resolve_path(path);
        
        let atime = atime.map(filetime::FileTime::from_system_time);
        let mtime = mtime.map(filetime::FileTime::from_system_time);
        
        if let (Some(a), Some(m)) = (atime, mtime) {
            filetime::set_file_times(&full_path, a, m)?;
        } else if let Some(m) = mtime {
            filetime::set_file_mtime(&full_path, m)?;
        } else if let Some(a) = atime {
            filetime::set_file_atime(&full_path, a)?;
        }
        
        Ok(())
    }
    
    // =========================================================================
    // Extended Operations
    // =========================================================================
    
    async fn file_size(&self, path: &Path) -> Result<u64> {
        let full_path = self.resolve_path(path);
        let metadata = fs::metadata(&full_path).await?;
        Ok(metadata.len())
    }
    
    async fn available_space(&self) -> Result<u64> {
        crate::vfs::platform::get_available_space(&self.base_path)
    }
    
    async fn total_space(&self) -> Result<u64> {
        crate::vfs::platform::get_total_space(&self.base_path)
    }
    
    fn is_read_only(&self) -> bool {
        false
    }
    
    fn root_path(&self) -> &Path {
        &self.base_path
    }
}

// =============================================================================
// Helper methods for LocalStorageAdapter
// =============================================================================

impl LocalStorageAdapter {
    /// Get file mode (Unix permissions) from metadata
    fn get_mode(&self, metadata: &std::fs::Metadata) -> Option<u32> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            Some(metadata.permissions().mode())
        }
        
        #[cfg(not(unix))]
        {
            let _ = metadata;
            None
        }
    }
    
    /// Get user ID from metadata
    fn get_uid(&self, metadata: &std::fs::Metadata) -> u32 {
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            metadata.uid()
        }
        
        #[cfg(not(unix))]
        {
            let _ = metadata;
            0
        }
    }
    
    /// Get group ID from metadata
    fn get_gid(&self, metadata: &std::fs::Metadata) -> u32 {
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            metadata.gid()
        }
        
        #[cfg(not(unix))]
        {
            let _ = metadata;
            0
        }
    }
    
    /// Copy directory recursively
    async fn copy_dir_recursive(&self, from: &Path, to: &Path, options: &CopyOptions) -> Result<()> {
        fs::create_dir_all(to).await?;
        
        let mut entries = fs::read_dir(from).await?;
        
        while let Some(entry) = entries.next_entry().await? {
            let entry_path = entry.path();
            let dest_path = to.join(entry.file_name());
            
            let metadata = entry.metadata().await?;
            
            if metadata.is_dir() {
                Box::pin(self.copy_dir_recursive(&entry_path, &dest_path, options)).await?;
            } else if metadata.is_symlink() && !options.follow_symlinks {
                let target = fs::read_link(&entry_path).await?;
                #[cfg(unix)]
                tokio::fs::symlink(&target, &dest_path).await?;
                #[cfg(windows)]
                tokio::fs::symlink_file(&target, &dest_path).await?;
            } else {
                fs::copy(&entry_path, &dest_path).await?;
            }
            
            if options.preserve_attributes {
                self.preserve_attributes(&entry_path, &dest_path).await.ok();
            }
        }
        
        Ok(())
    }
    
    /// Preserve file attributes (mode, times)
    async fn preserve_attributes(&self, from: &Path, to: &Path) -> Result<()> {
        let metadata = fs::metadata(from).await?;
        
        // Preserve permissions
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = std::fs::Permissions::from_mode(metadata.permissions().mode());
            fs::set_permissions(to, perms).await?;
        }
        
        // Preserve times
        if let (Ok(mtime), Ok(atime)) = (metadata.modified(), metadata.accessed()) {
            let mtime = filetime::FileTime::from_system_time(mtime);
            let atime = filetime::FileTime::from_system_time(atime);
            filetime::set_file_times(to, atime, mtime)?;
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_local_adapter_list_files() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        // Create test files
        std::fs::write(temp_dir.path().join("test.txt"), "hello").unwrap();
        std::fs::create_dir(temp_dir.path().join("subdir")).unwrap();
        
        let files = adapter.list_files(Path::new("/")).await.unwrap();
        
        assert_eq!(files.len(), 2);
        // Directories should come first
        assert!(files[0].is_directory);
        assert_eq!(files[0].name, "subdir");
        assert!(!files[1].is_directory);
        assert_eq!(files[1].name, "test.txt");
    }
    
    #[tokio::test]
    async fn test_local_adapter_read_write() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        let data = b"Hello, World!";
        adapter.write_file(Path::new("/test.txt"), data).await.unwrap();
        
        let read_data = adapter.read_file(Path::new("/test.txt")).await.unwrap();
        assert_eq!(read_data, data);
    }
    
    #[tokio::test]
    async fn test_local_adapter_tier_status() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        std::fs::write(temp_dir.path().join("test.txt"), "hello").unwrap();
        
        let metadata = adapter.get_metadata(Path::new("/test.txt")).await.unwrap();
        
        // Local files should always be hot
        assert_eq!(metadata.tier_status.current_tier, StorageTier::Hot);
        assert!(metadata.tier_status.is_cached);
    }
    
    // =========================================================================
    // IFileOperations Tests
    // =========================================================================
    
    #[tokio::test]
    async fn test_file_ops_mkdir_and_rmdir() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        // Create directory
        IFileOperations::mkdir(&adapter, Path::new("/testdir")).await.unwrap();
        assert!(IFileOperations::is_dir(&adapter, Path::new("/testdir")).await.unwrap());
        
        // Remove directory
        IFileOperations::rmdir(&adapter, Path::new("/testdir")).await.unwrap();
        assert!(!IFileOperations::exists(&adapter, Path::new("/testdir")).await.unwrap());
    }
    
    #[tokio::test]
    async fn test_file_ops_mkdir_p() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        // Create nested directories
        IFileOperations::mkdir_p(&adapter, Path::new("/a/b/c/d")).await.unwrap();
        assert!(IFileOperations::is_dir(&adapter, Path::new("/a/b/c/d")).await.unwrap());
    }
    
    #[tokio::test]
    async fn test_file_ops_rename() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        // Create file
        IFileOperations::write(&adapter, Path::new("/original.txt"), b"content").await.unwrap();
        
        // Rename it
        IFileOperations::rename(&adapter, Path::new("/original.txt"), Path::new("/renamed.txt")).await.unwrap();
        
        assert!(!IFileOperations::exists(&adapter, Path::new("/original.txt")).await.unwrap());
        assert!(IFileOperations::exists(&adapter, Path::new("/renamed.txt")).await.unwrap());
        
        let content = IFileOperations::read(&adapter, Path::new("/renamed.txt")).await.unwrap();
        assert_eq!(content, b"content");
    }
    
    #[tokio::test]
    async fn test_file_ops_copy() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        // Create file
        IFileOperations::write(&adapter, Path::new("/source.txt"), b"hello world").await.unwrap();
        
        // Copy it
        let opts = CopyOptions::default();
        IFileOperations::copy(&adapter, Path::new("/source.txt"), Path::new("/dest.txt"), opts).await.unwrap();
        
        // Both should exist
        assert!(IFileOperations::exists(&adapter, Path::new("/source.txt")).await.unwrap());
        assert!(IFileOperations::exists(&adapter, Path::new("/dest.txt")).await.unwrap());
        
        // Content should match
        let content = IFileOperations::read(&adapter, Path::new("/dest.txt")).await.unwrap();
        assert_eq!(content, b"hello world");
    }
    
    #[tokio::test]
    async fn test_file_ops_move() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        // Create file
        IFileOperations::write(&adapter, Path::new("/source.txt"), b"move me").await.unwrap();
        
        // Move it
        let opts = MoveOptions::default();
        IFileOperations::mv(&adapter, Path::new("/source.txt"), Path::new("/subdir/dest.txt"), opts).await.unwrap();
        
        // Source should not exist, dest should
        assert!(!IFileOperations::exists(&adapter, Path::new("/source.txt")).await.unwrap());
        assert!(IFileOperations::exists(&adapter, Path::new("/subdir/dest.txt")).await.unwrap());
    }
    
    #[tokio::test]
    async fn test_file_ops_rm_rf() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        // Create nested structure
        IFileOperations::mkdir_p(&adapter, Path::new("/parent/child")).await.unwrap();
        IFileOperations::write(&adapter, Path::new("/parent/file1.txt"), b"1").await.unwrap();
        IFileOperations::write(&adapter, Path::new("/parent/child/file2.txt"), b"2").await.unwrap();
        
        // Remove recursively
        IFileOperations::rm_rf(&adapter, Path::new("/parent")).await.unwrap();
        
        assert!(!IFileOperations::exists(&adapter, Path::new("/parent")).await.unwrap());
    }
    
    #[tokio::test]
    async fn test_file_ops_stat() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        IFileOperations::write(&adapter, Path::new("/test.txt"), b"12345").await.unwrap();
        
        let stat = IFileOperations::stat(&adapter, Path::new("/test.txt")).await.unwrap();
        
        assert_eq!(stat.size, 5);
        assert!(stat.is_file);
        assert!(!stat.is_dir);
    }
    
    #[tokio::test]
    async fn test_file_ops_append() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        IFileOperations::write(&adapter, Path::new("/log.txt"), b"line1\n").await.unwrap();
        IFileOperations::append(&adapter, Path::new("/log.txt"), b"line2\n").await.unwrap();
        
        let content = IFileOperations::read(&adapter, Path::new("/log.txt")).await.unwrap();
        assert_eq!(content, b"line1\nline2\n");
    }
    
    #[tokio::test]
    async fn test_file_ops_list() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        IFileOperations::mkdir(&adapter, Path::new("/mydir")).await.unwrap();
        IFileOperations::write(&adapter, Path::new("/file1.txt"), b"1").await.unwrap();
        IFileOperations::write(&adapter, Path::new("/file2.txt"), b"2").await.unwrap();
        
        let entries = IFileOperations::list(&adapter, Path::new("/")).await.unwrap();
        
        assert_eq!(entries.len(), 3);
        // Directories come first
        assert!(entries[0].is_dir);
        assert_eq!(entries[0].name, "mydir");
    }
}

