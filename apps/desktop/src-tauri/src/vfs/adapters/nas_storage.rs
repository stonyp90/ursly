//! NAS Storage Adapter
//!
//! Implements storage adapter for NAS devices accessed via NFS or SMB mounts.
//! This is essentially a specialized local storage adapter optimized for
//! network-mounted filesystems.

use anyhow::{Context, Result};
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use tracing::{debug, info, warn};

use crate::vfs::domain::{VirtualFile, StorageSourceType, TierStatus, StorageTier};
use crate::vfs::ports::{
    StorageAdapter, IFileOperations, FileEntry, FileStat, CopyOptions, MoveOptions
};

/// NAS protocol type
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NasProtocol {
    NFS,
    SMB,
    AFP, // Apple Filing Protocol
    Unknown,
}

/// NAS storage adapter for mounted network shares
pub struct NasStorageAdapter {
    /// Mount point of the NAS share
    mount_point: PathBuf,
    
    /// Display name
    name: String,
    
    /// Protocol used
    protocol: NasProtocol,
    
    /// Server hostname/IP
    server: Option<String>,
    
    /// Connection monitor for timeout and reconnection
    connection_monitor: crate::vfs::platform::ConnectionMonitor,
}

impl NasStorageAdapter {
    /// Create a new NAS adapter
    pub fn new(
        mount_point: PathBuf,
        name: String,
        protocol: NasProtocol,
        server: Option<String>,
    ) -> Self {
        let endpoint = format!(
            "{}://{}{}",
            match protocol {
                NasProtocol::NFS => "nfs",
                NasProtocol::SMB => "smb",
                NasProtocol::AFP => "afp",
                NasProtocol::Unknown => "unknown",
            },
            server.as_deref().unwrap_or("localhost"),
            mount_point.display()
        );
        
        Self {
            mount_point: mount_point.clone(),
            name,
            protocol,
            server,
            connection_monitor: crate::vfs::platform::ConnectionMonitor::new(endpoint),
        }
    }
    
    /// Create from an NFS mount
    pub fn from_nfs(mount_point: PathBuf, name: String, server: Option<String>) -> Self {
        Self::new(mount_point, name, NasProtocol::NFS, server)
    }
    
    /// Create from an SMB mount
    pub fn from_smb(mount_point: PathBuf, name: String, server: Option<String>) -> Self {
        Self::new(mount_point, name, NasProtocol::SMB, server)
    }
    
    /// Resolve a VFS path to the actual filesystem path
    fn resolve_path(&self, path: &Path) -> PathBuf {
        if path.is_absolute() && path.starts_with(&self.mount_point) {
            path.to_path_buf()
        } else {
            self.mount_point.join(path.strip_prefix("/").unwrap_or(path))
        }
    }
    
    /// Get file mode from metadata
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
            } else {
                fs::copy(&entry_path, &dest_path).await?;
            }
        }
        
        Ok(())
    }
}

#[async_trait]
impl StorageAdapter for NasStorageAdapter {
    fn storage_type(&self) -> StorageSourceType {
        StorageSourceType::Nas
    }
    
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn test_connection(&self) -> Result<bool> {
        // Use connection monitor with timeout
        Ok(self.connection_monitor.check_path_connection(&self.mount_point).await)
    }
    
    async fn list_files(&self, path: &Path) -> Result<Vec<VirtualFile>> {
        let full_path = self.resolve_path(path);
        debug!("Listing NAS files at: {:?}", full_path);
        
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
            
            // NAS files are "warm" by default - accessible but slower than local
            vfile.tier_status = TierStatus {
                current_tier: StorageTier::Warm,
                is_cached: false,
                can_warm: true, // Can be cached locally
                retrieval_time_estimate: Some(1), // ~1 second for network access
            };
            
            vfile.transcodable = vfile.can_transcode();
            
            if let Ok(modified) = metadata.modified() {
                vfile.last_modified = modified;
            }
            
            files.push(vfile);
        }
        
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
        fs::read(&full_path).await.with_context(|| format!("Failed to read: {:?}", full_path))
    }
    
    async fn read_file_range(&self, path: &Path, offset: u64, length: u64) -> Result<Vec<u8>> {
        let full_path = self.resolve_path(path);
        let mut file = fs::File::open(&full_path).await?;
        file.seek(std::io::SeekFrom::Start(offset)).await?;
        let mut buffer = vec![0u8; length as usize];
        let bytes_read = file.read(&mut buffer).await?;
        buffer.truncate(bytes_read);
        Ok(buffer)
    }
    
    async fn write_file(&self, path: &Path, data: &[u8]) -> Result<()> {
        let full_path = self.resolve_path(path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        fs::write(&full_path, data).await?;
        Ok(())
    }
    
    async fn get_metadata(&self, path: &Path) -> Result<VirtualFile> {
        let full_path = self.resolve_path(path);
        let metadata = fs::metadata(&full_path).await?;
        
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
            current_tier: StorageTier::Warm,
            is_cached: false,
            can_warm: true,
            retrieval_time_estimate: Some(1),
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

// IFileOperations implementation (similar to LocalStorageAdapter and FsxOntapAdapter)
#[async_trait]
impl IFileOperations for NasStorageAdapter {
    async fn list(&self, path: &Path) -> Result<Vec<FileEntry>> {
        let full_path = self.resolve_path(path);
        let mut entries = Vec::new();
        let mut dir = fs::read_dir(&full_path).await?;
        
        while let Some(entry) = dir.next_entry().await? {
            let metadata = entry.metadata().await?;
            let name = entry.file_name().to_string_lossy().to_string();
            let file_path = path.join(&name);
            
            entries.push(FileEntry {
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
                mime_type: None,
            });
        }
        
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
        let metadata = fs::metadata(&full_path).await?;
        
        Ok(FileStat {
            size: metadata.len(),
            is_dir: metadata.is_dir(),
            is_file: metadata.is_file(),
            is_symlink: metadata.file_type().is_symlink(),
            mtime: metadata.modified().ok(),
            atime: metadata.accessed().ok(),
            ctime: metadata.created().ok(),
            mode: self.get_mode(&metadata).unwrap_or(0o644),
            nlink: 1,
            uid: self.get_uid(&metadata),
            gid: self.get_gid(&metadata),
            blksize: 4096,
            blocks: (metadata.len() + 511) / 512,
        })
    }
    
    async fn read(&self, path: &Path) -> Result<Vec<u8>> {
        let full_path = self.resolve_path(path);
        fs::read(&full_path).await.with_context(|| format!("Failed to read: {:?}", full_path))
    }
    
    async fn read_range(&self, path: &Path, offset: u64, len: u64) -> Result<Vec<u8>> {
        let full_path = self.resolve_path(path);
        let mut file = fs::File::open(&full_path).await?;
        file.seek(std::io::SeekFrom::Start(offset)).await?;
        let mut buffer = vec![0u8; len as usize];
        let bytes_read = file.read(&mut buffer).await?;
        buffer.truncate(bytes_read);
        Ok(buffer)
    }
    
    async fn write(&self, path: &Path, data: &[u8]) -> Result<()> {
        let full_path = self.resolve_path(path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        fs::write(&full_path, data).await?;
        Ok(())
    }
    
    async fn append(&self, path: &Path, data: &[u8]) -> Result<()> {
        let full_path = self.resolve_path(path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        let mut file = fs::OpenOptions::new().create(true).append(true).open(&full_path).await?;
        file.write_all(data).await?;
        Ok(())
    }
    
    async fn write_at(&self, path: &Path, offset: u64, data: &[u8]) -> Result<()> {
        let full_path = self.resolve_path(path);
        let mut file = fs::OpenOptions::new().write(true).open(&full_path).await?;
        file.seek(std::io::SeekFrom::Start(offset)).await?;
        file.write_all(data).await?;
        Ok(())
    }
    
    async fn truncate(&self, path: &Path, len: u64) -> Result<()> {
        let full_path = self.resolve_path(path);
        let file = fs::File::open(&full_path).await?;
        file.set_len(len).await?;
        Ok(())
    }
    
    async fn mkdir(&self, path: &Path) -> Result<()> {
        let full_path = self.resolve_path(path);
        fs::create_dir(&full_path).await?;
        Ok(())
    }
    
    async fn mkdir_p(&self, path: &Path) -> Result<()> {
        let full_path = self.resolve_path(path);
        fs::create_dir_all(&full_path).await?;
        Ok(())
    }
    
    async fn rmdir(&self, path: &Path) -> Result<()> {
        let full_path = self.resolve_path(path);
        fs::remove_dir(&full_path).await?;
        Ok(())
    }
    
    async fn rename(&self, from: &Path, to: &Path) -> Result<()> {
        let from_path = self.resolve_path(from);
        let to_path = self.resolve_path(to);
        if let Some(parent) = to_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        fs::rename(&from_path, &to_path).await?;
        Ok(())
    }
    
    async fn copy(&self, from: &Path, to: &Path, options: CopyOptions) -> Result<()> {
        let from_path = self.resolve_path(from);
        let to_path = self.resolve_path(to);
        
        if to_path.exists() && !options.overwrite {
            return Err(anyhow::anyhow!("Destination already exists"));
        }
        
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
        }
        
        Ok(())
    }
    
    async fn mv(&self, from: &Path, to: &Path, options: MoveOptions) -> Result<()> {
        let from_path = self.resolve_path(from);
        let to_path = self.resolve_path(to);
        
        if to_path.exists() && !options.overwrite {
            return Err(anyhow::anyhow!("Destination already exists"));
        }
        
        if let Some(parent) = to_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        fs::rename(&from_path, &to_path).await?;
        Ok(())
    }
    
    async fn rm(&self, path: &Path) -> Result<()> {
        let full_path = self.resolve_path(path);
        fs::remove_file(&full_path).await?;
        Ok(())
    }
    
    async fn rm_rf(&self, path: &Path) -> Result<()> {
        let full_path = self.resolve_path(path);
        if !full_path.exists() {
            return Ok(());
        }
        let metadata = fs::metadata(&full_path).await?;
        if metadata.is_dir() {
            fs::remove_dir_all(&full_path).await?;
        } else {
            fs::remove_file(&full_path).await?;
        }
        Ok(())
    }
    
    async fn symlink(&self, target: &Path, link: &Path) -> Result<()> {
        let link_path = self.resolve_path(link);
        #[cfg(unix)]
        tokio::fs::symlink(target, &link_path).await?;
        #[cfg(windows)]
        if target.is_dir() {
            tokio::fs::symlink_dir(target, &link_path).await?;
        } else {
            tokio::fs::symlink_file(target, &link_path).await?;
        }
        Ok(())
    }
    
    async fn readlink(&self, path: &Path) -> Result<String> {
        let full_path = self.resolve_path(path);
        let target = fs::read_link(&full_path).await?;
        Ok(target.to_string_lossy().to_string())
    }
    
    async fn exists(&self, path: &Path) -> Result<bool> {
        Ok(self.resolve_path(path).exists())
    }
    
    async fn is_dir(&self, path: &Path) -> Result<bool> {
        Ok(self.resolve_path(path).is_dir())
    }
    
    async fn is_file(&self, path: &Path) -> Result<bool> {
        Ok(self.resolve_path(path).is_file())
    }
    
    async fn is_symlink(&self, path: &Path) -> Result<bool> {
        let full_path = self.resolve_path(path);
        let metadata = fs::symlink_metadata(&full_path).await?;
        Ok(metadata.file_type().is_symlink())
    }
    
    async fn chmod(&self, path: &Path, mode: u32) -> Result<()> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let full_path = self.resolve_path(path);
            let permissions = std::fs::Permissions::from_mode(mode);
            fs::set_permissions(&full_path, permissions).await?;
        }
        #[cfg(not(unix))]
        warn!("chmod not supported on this platform");
        Ok(())
    }
    
    async fn chown(&self, path: &Path, uid: u32, gid: u32) -> Result<()> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::chown;
            let full_path = self.resolve_path(path);
            tokio::task::spawn_blocking(move || chown(&full_path, Some(uid), Some(gid))).await??;
        }
        #[cfg(not(unix))]
        warn!("chown not supported on this platform");
        Ok(())
    }
    
    async fn touch(&self, path: &Path) -> Result<()> {
        let full_path = self.resolve_path(path);
        if full_path.exists() {
            let now = filetime::FileTime::now();
            filetime::set_file_mtime(&full_path, now)?;
        } else {
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
    
    async fn file_size(&self, path: &Path) -> Result<u64> {
        let full_path = self.resolve_path(path);
        let metadata = fs::metadata(&full_path).await?;
        Ok(metadata.len())
    }
    
    async fn available_space(&self) -> Result<u64> {
        crate::vfs::platform::get_available_space(&self.mount_point)
    }
    
    async fn total_space(&self) -> Result<u64> {
        crate::vfs::platform::get_total_space(&self.mount_point)
    }
    
    fn is_read_only(&self) -> bool {
        false
    }
    
    fn root_path(&self) -> &Path {
        &self.mount_point
    }
}

// =============================================================================
// Unit Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_nas_protocol_enum() {
        assert_eq!(NasProtocol::NFS, NasProtocol::NFS);
        assert_ne!(NasProtocol::NFS, NasProtocol::SMB);
        assert_eq!(NasProtocol::AFP, NasProtocol::AFP);
        assert_eq!(NasProtocol::Unknown, NasProtocol::Unknown);
    }
    
    #[test]
    fn test_adapter_creation() {
        let adapter = NasStorageAdapter::new(
            PathBuf::from("/mnt/nas"),
            "Media NAS".to_string(),
            NasProtocol::NFS,
            Some("nas.local".to_string()),
        );
        
        assert_eq!(adapter.name(), "Media NAS");
        assert_eq!(adapter.root_path(), Path::new("/mnt/nas"));
    }
    
    #[test]
    fn test_resolve_path_absolute() {
        let adapter = NasStorageAdapter::new(
            PathBuf::from("/mnt/nas"),
            "Test".to_string(),
            NasProtocol::SMB,
            None,
        );
        
        let path = Path::new("/mnt/nas/videos/movie.mp4");
        let resolved = adapter.resolve_path(path);
        assert_eq!(resolved, path);
    }
    
    #[test]
    fn test_resolve_path_relative() {
        let adapter = NasStorageAdapter::new(
            PathBuf::from("/mnt/nas"),
            "Test".to_string(),
            NasProtocol::NFS,
            None,
        );
        
        let path = Path::new("videos/movie.mp4");
        let resolved = adapter.resolve_path(path);
        assert_eq!(resolved, PathBuf::from("/mnt/nas/videos/movie.mp4"));
    }
    
    #[test]
    fn test_resolve_path_leading_slash() {
        let adapter = NasStorageAdapter::new(
            PathBuf::from("/mnt/nas"),
            "Test".to_string(),
            NasProtocol::NFS,
            None,
        );
        
        let path = Path::new("/videos/movie.mp4");
        let resolved = adapter.resolve_path(path);
        assert_eq!(resolved, PathBuf::from("/mnt/nas/videos/movie.mp4"));
    }
    
    #[tokio::test]
    async fn test_storage_type() {
        let adapter = NasStorageAdapter::new(
            PathBuf::from("/tmp/test"),
            "Test".to_string(),
            NasProtocol::NFS,
            None,
        );
        
        assert_eq!(adapter.storage_type(), StorageSourceType::Nas);
    }
    
    #[tokio::test]
    async fn test_connection_test_success() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = NasStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
            NasProtocol::NFS,
            None,
        );
        
        let result = adapter.test_connection().await.unwrap();
        assert!(result);
    }
    
    #[tokio::test]
    async fn test_connection_test_failure() {
        let adapter = NasStorageAdapter::new(
            PathBuf::from("/non/existent/path"),
            "Test".to_string(),
            NasProtocol::NFS,
            None,
        );
        
        let result = adapter.test_connection().await.unwrap();
        assert!(!result);
    }
    
    #[tokio::test]
    async fn test_list_files() {
        let temp_dir = TempDir::new().unwrap();
        
        // Create test files
        std::fs::write(temp_dir.path().join("file1.txt"), "content1").unwrap();
        std::fs::write(temp_dir.path().join("file2.txt"), "content2").unwrap();
        std::fs::create_dir(temp_dir.path().join("subdir")).unwrap();
        
        let adapter = NasStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
            NasProtocol::NFS,
            None,
        );
        
        let files = adapter.list_files(Path::new("/")).await.unwrap();
        
        assert_eq!(files.len(), 3);
        // Directory should come first
        assert!(files[0].is_directory);
    }
    
    #[tokio::test]
    async fn test_read_write_file() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = NasStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
            NasProtocol::NFS,
            None,
        );
        
        let content = b"Hello, NAS World!";
        adapter.write_file(Path::new("/test.txt"), content).await.unwrap();
        
        let read_content = adapter.read_file(Path::new("/test.txt")).await.unwrap();
        assert_eq!(read_content, content);
    }
}

