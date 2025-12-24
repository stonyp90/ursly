//! FSx for NetApp ONTAP Storage Adapter
//!
//! Implements storage adapter for AWS FSx for NetApp ONTAP.
//! FSx ONTAP supports:
//! - NFS/SMB access for hot data
//! - S3 access points for tiered (cold) data
//! - FlexCache for caching
//! - SnapMirror for replication

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

/// FSx for NetApp ONTAP tier information
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FsxTier {
    /// Data is in SSD tier (hot)
    Hot,
    /// Data is being tiered to capacity pool
    Tiering,
    /// Data is in capacity pool (cold)
    Cold,
    /// Data is being retrieved from capacity pool
    Retrieving,
}

/// FSx ONTAP storage adapter
/// 
/// This adapter works with FSx ONTAP volumes mounted via NFS.
/// It integrates with ONTAP's tiering policies to show tier status.
pub struct FsxOntapAdapter {
    /// Mount point of the FSx volume
    mount_point: PathBuf,
    
    /// Display name
    name: String,
    
    /// S3 access point for tiered data (optional)
    s3_access_point: Option<String>,
    
    /// ONTAP REST API endpoint (optional)
    api_endpoint: Option<String>,
}

impl FsxOntapAdapter {
    /// Create a new FSx ONTAP adapter
    pub fn new(
        mount_point: PathBuf,
        name: String,
        s3_access_point: Option<String>,
        api_endpoint: Option<String>,
    ) -> Self {
        Self {
            mount_point,
            name,
            s3_access_point,
            api_endpoint,
        }
    }
    
    /// Resolve a VFS path to the actual filesystem path
    fn resolve_path(&self, path: &Path) -> PathBuf {
        if path.is_absolute() && path.starts_with(&self.mount_point) {
            path.to_path_buf()
        } else {
            self.mount_point.join(path.strip_prefix("/").unwrap_or(path))
        }
    }
    
    /// Detect the tier status of a file
    /// 
    /// In FSx ONTAP, tiering is based on cooling period and access patterns.
    /// We can detect this via extended attributes or the ONTAP REST API.
    async fn detect_tier(&self, path: &Path) -> TierStatus {
        // In a real implementation, this would query ONTAP's fabric-pool
        // tiering metadata using:
        // 1. Extended attributes (xattr) for tier state
        // 2. ONTAP REST API for detailed tiering info
        // 3. File access time heuristics
        
        let full_path = self.resolve_path(path);
        
        // Simple heuristic: check last access time
        // Files not accessed in 30 days are likely cold
        if let Ok(metadata) = fs::metadata(&full_path).await {
            if let Ok(accessed) = metadata.accessed() {
                if let Ok(duration) = SystemTime::now().duration_since(accessed) {
                    let days_since_access = duration.as_secs() / 86400;
                    
                    if days_since_access > 90 {
                        return TierStatus {
                            current_tier: StorageTier::Archive,
                            is_cached: false,
                            can_warm: true,
                            retrieval_time_estimate: Some(3600), // 1 hour for archive
                        };
                    } else if days_since_access > 30 {
                        return TierStatus {
                            current_tier: StorageTier::Cold,
                            is_cached: false,
                            can_warm: true,
                            retrieval_time_estimate: Some(60), // 1 minute for cold
                        };
                    }
                }
            }
        }
        
        // Default: hot tier
        TierStatus {
            current_tier: StorageTier::Hot,
            is_cached: true,
            can_warm: false,
            retrieval_time_estimate: Some(0),
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
impl StorageAdapter for FsxOntapAdapter {
    fn storage_type(&self) -> StorageSourceType {
        StorageSourceType::FsxN
    }
    
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn test_connection(&self) -> Result<bool> {
        Ok(self.mount_point.exists() && self.mount_point.is_dir())
    }
    
    async fn list_files(&self, path: &Path) -> Result<Vec<VirtualFile>> {
        let full_path = self.resolve_path(path);
        debug!("Listing FSx ONTAP files at: {:?}", full_path);
        
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
                file_path.clone(),
                metadata.len(),
                metadata.is_dir(),
            );
            
            // Detect tier status based on access patterns
            if !metadata.is_dir() {
                vfile.tier_status = self.detect_tier(&file_path).await;
            } else {
                vfile.tier_status = TierStatus {
                    current_tier: StorageTier::Hot,
                    is_cached: true,
                    can_warm: false,
                    retrieval_time_estimate: Some(0),
                };
            }
            
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
        debug!("Reading FSx file: {:?}", full_path);
        
        fs::read(&full_path)
            .await
            .with_context(|| format!("Failed to read file: {:?}", full_path))
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
        debug!("Writing FSx file: {:?}", full_path);
        
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
        
        vfile.tier_status = self.detect_tier(path).await;
        
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
// IFileOperations Implementation for FSx ONTAP
// =============================================================================

#[async_trait]
impl IFileOperations for FsxOntapAdapter {
    async fn list(&self, path: &Path) -> Result<Vec<FileEntry>> {
        let full_path = self.resolve_path(path);
        let mut entries = Vec::new();
        let mut dir = fs::read_dir(&full_path).await?;
        
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
                mime_type: None,
            };
            
            entries.push(file_entry);
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
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&full_path)
            .await?;
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
        {
            if target.is_dir() {
                tokio::fs::symlink_dir(target, &link_path).await?;
            } else {
                tokio::fs::symlink_file(target, &link_path).await?;
            }
        }
        Ok(())
    }
    
    async fn readlink(&self, path: &Path) -> Result<String> {
        let full_path = self.resolve_path(path);
        let target = fs::read_link(&full_path).await?;
        Ok(target.to_string_lossy().to_string())
    }
    
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
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let permissions = std::fs::Permissions::from_mode(mode);
            fs::set_permissions(&full_path, permissions).await?;
        }
        #[cfg(not(unix))]
        {
            warn!("chmod not supported on this platform");
        }
        Ok(())
    }
    
    async fn chown(&self, path: &Path, uid: u32, gid: u32) -> Result<()> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::chown;
            let full_path = self.resolve_path(path);
            tokio::task::spawn_blocking(move || chown(&full_path, Some(uid), Some(gid)))
                .await??;
        }
        #[cfg(not(unix))]
        {
            warn!("chown not supported on this platform");
        }
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
        #[cfg(unix)]
        {
            let stat = nix::sys::statvfs::statvfs(&self.mount_point)?;
            Ok(stat.blocks_available() as u64 * stat.block_size() as u64)
        }
        #[cfg(not(unix))]
        {
            Ok(0)
        }
    }
    
    async fn total_space(&self) -> Result<u64> {
        #[cfg(unix)]
        {
            let stat = nix::sys::statvfs::statvfs(&self.mount_point)?;
            Ok(stat.blocks() as u64 * stat.block_size() as u64)
        }
        #[cfg(not(unix))]
        {
            Ok(0)
        }
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
    fn test_fsx_tier_enum() {
        assert_eq!(FsxTier::Hot, FsxTier::Hot);
        assert_ne!(FsxTier::Hot, FsxTier::Cold);
        assert_eq!(FsxTier::Tiering, FsxTier::Tiering);
        assert_eq!(FsxTier::Retrieving, FsxTier::Retrieving);
    }
    
    #[test]
    fn test_adapter_creation() {
        let adapter = FsxOntapAdapter::new(
            PathBuf::from("/mnt/fsx"),
            "Production FSx".to_string(),
            Some("arn:aws:s3:us-east-1:123456789:accesspoint/my-ap".to_string()),
            Some("https://fsx.example.com/api".to_string()),
        );
        
        assert_eq!(adapter.name(), "Production FSx");
        assert_eq!(adapter.root_path(), Path::new("/mnt/fsx"));
    }
    
    #[test]
    fn test_resolve_path_absolute() {
        let adapter = FsxOntapAdapter::new(
            PathBuf::from("/mnt/fsx"),
            "Test".to_string(),
            None,
            None,
        );
        
        // Absolute path within mount point should be preserved
        let path = Path::new("/mnt/fsx/data/file.txt");
        let resolved = adapter.resolve_path(path);
        assert_eq!(resolved, path);
    }
    
    #[test]
    fn test_resolve_path_relative() {
        let adapter = FsxOntapAdapter::new(
            PathBuf::from("/mnt/fsx"),
            "Test".to_string(),
            None,
            None,
        );
        
        // Relative path should be joined with mount point
        let path = Path::new("data/file.txt");
        let resolved = adapter.resolve_path(path);
        assert_eq!(resolved, PathBuf::from("/mnt/fsx/data/file.txt"));
    }
    
    #[test]
    fn test_resolve_path_leading_slash() {
        let adapter = FsxOntapAdapter::new(
            PathBuf::from("/mnt/fsx"),
            "Test".to_string(),
            None,
            None,
        );
        
        // Path with leading slash should be joined correctly
        let path = Path::new("/data/file.txt");
        let resolved = adapter.resolve_path(path);
        assert_eq!(resolved, PathBuf::from("/mnt/fsx/data/file.txt"));
    }
    
    #[tokio::test]
    async fn test_storage_type() {
        let adapter = FsxOntapAdapter::new(
            PathBuf::from("/tmp/test"),
            "Test".to_string(),
            None,
            None,
        );
        
        assert_eq!(adapter.storage_type(), StorageSourceType::FsxN);
    }
    
    #[tokio::test]
    async fn test_connection_test() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = FsxOntapAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
            None,
            None,
        );
        
        // Existing directory should pass connection test
        let result = adapter.test_connection().await.unwrap();
        assert!(result);
    }
    
    #[tokio::test]
    async fn test_connection_test_non_existent() {
        let adapter = FsxOntapAdapter::new(
            PathBuf::from("/non/existent/path"),
            "Test".to_string(),
            None,
            None,
        );
        
        // Non-existent path should fail connection test
        let result = adapter.test_connection().await.unwrap();
        assert!(!result);
    }
}

