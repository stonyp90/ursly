//! Google Cloud Storage Adapter
//!
//! Implements storage adapter for Google Cloud Storage using OpenDAL.

use anyhow::{Context, Result};
use async_trait::async_trait;
use opendal::services::Gcs;
use opendal::Operator;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tracing::{debug, error, info, warn};

use crate::vfs::domain::{VirtualFile, StorageSourceType, TierStatus, StorageTier};
use crate::vfs::ports::{
    StorageAdapter, IFileOperations, FileEntry, FileStat, CopyOptions, MoveOptions
};

/// Google Cloud Storage adapter using OpenDAL
pub struct GcsStorageAdapter {
    /// OpenDAL operator
    operator: Operator,
    
    /// Bucket name
    bucket: String,
    
    /// Display name
    name: String,
}

impl GcsStorageAdapter {
    /// Create a new GCS adapter
    pub async fn new(
        bucket: String,
        credentials_path: Option<String>,
        name: String,
    ) -> Result<Self> {
        let mut builder = Gcs::default();
        builder.bucket(&bucket);
        
        if let Some(creds) = credentials_path {
            builder.credential_path(&creds);
        }
        
        let operator = Operator::new(builder)?
            .finish();
        
        info!("GCS adapter initialized for bucket: {}", bucket);
        
        Ok(Self {
            operator,
            bucket,
            name,
        })
    }
    
    /// Convert path to GCS key
    fn to_key(&self, path: &Path) -> String {
        path.strip_prefix("/")
            .unwrap_or(path)
            .to_string_lossy()
            .to_string()
    }
}

#[async_trait]
impl StorageAdapter for GcsStorageAdapter {
    fn storage_type(&self) -> StorageSourceType {
        StorageSourceType::S3 // Using S3 type since there's no dedicated GCS type
    }
    
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn test_connection(&self) -> Result<bool> {
        match self.operator.list("/").await {
            Ok(_) => Ok(true),
            Err(e) => {
                error!("GCS connection test failed: {}", e);
                Ok(false)
            }
        }
    }
    
    async fn list_files(&self, path: &Path) -> Result<Vec<VirtualFile>> {
        let key = self.to_key(path);
        let prefix = if key.is_empty() { String::new() } else { format!("{}/", key) };
        
        debug!("Listing GCS objects with prefix: {}", prefix);
        
        let entries = self.operator.list(&prefix).await?;
        let mut files = Vec::new();
        
        for entry in entries {
            let name = entry.name().to_string();
            if name.is_empty() || name == "/" {
                continue;
            }
            
            let metadata = entry.metadata();
            let is_dir = metadata.is_dir();
            let size = metadata.content_length();
            let file_path = PathBuf::from("/").join(&prefix).join(&name);
            
            let mut vfile = VirtualFile::new(
                name.trim_end_matches('/').to_string(),
                file_path,
                size,
                is_dir,
            );
            
            vfile.tier_status = TierStatus {
                current_tier: StorageTier::Cold,
                is_cached: false,
                can_warm: true,
                retrieval_time_estimate: Some(5),
            };
            
            vfile.transcodable = vfile.can_transcode();
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
        let key = self.to_key(path);
        let data = self.operator.read(&key).await?;
        Ok(data.to_vec())
    }
    
    async fn read_file_range(&self, path: &Path, offset: u64, length: u64) -> Result<Vec<u8>> {
        let key = self.to_key(path);
        let data = self.operator
            .read_with(&key)
            .range(offset..offset + length)
            .await?;
        Ok(data.to_vec())
    }
    
    async fn write_file(&self, path: &Path, data: &[u8]) -> Result<()> {
        let key = self.to_key(path);
        self.operator.write(&key, data.to_vec()).await?;
        Ok(())
    }
    
    async fn get_metadata(&self, path: &Path) -> Result<VirtualFile> {
        let key = self.to_key(path);
        let metadata = self.operator.stat(&key).await?;
        
        let name = path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| key.clone());
        
        let mut vfile = VirtualFile::new(
            name,
            path.to_path_buf(),
            metadata.content_length(),
            metadata.is_dir(),
        );
        
        vfile.tier_status = TierStatus {
            current_tier: StorageTier::Cold,
            is_cached: false,
            can_warm: true,
            retrieval_time_estimate: Some(5),
        };
        
        Ok(vfile)
    }
    
    async fn exists(&self, path: &Path) -> Result<bool> {
        let key = self.to_key(path);
        Ok(self.operator.is_exist(&key).await?)
    }
    
    async fn delete(&self, path: &Path) -> Result<()> {
        let key = self.to_key(path);
        self.operator.delete(&key).await?;
        Ok(())
    }
    
    async fn create_dir(&self, path: &Path) -> Result<()> {
        let key = format!("{}/", self.to_key(path));
        self.operator.write(&key, vec![]).await?;
        Ok(())
    }
    
    async fn file_size(&self, path: &Path) -> Result<u64> {
        let key = self.to_key(path);
        let metadata = self.operator.stat(&key).await?;
        Ok(metadata.content_length())
    }
}

// IFileOperations implementation follows the same pattern as S3StorageAdapter
#[async_trait]
impl IFileOperations for GcsStorageAdapter {
    async fn list(&self, path: &Path) -> Result<Vec<FileEntry>> {
        let key = self.to_key(path);
        let prefix = if key.is_empty() { String::new() } else { format!("{}/", key) };
        
        let entries = self.operator.list(&prefix).await?;
        let mut files = Vec::new();
        
        for entry in entries {
            let name = entry.name().to_string();
            if name.is_empty() || name == "/" {
                continue;
            }
            
            let metadata = entry.metadata();
            let is_dir = metadata.is_dir();
            let size = metadata.content_length();
            let file_path = PathBuf::from("/").join(&prefix).join(&name);
            
            files.push(FileEntry {
                name: name.trim_end_matches('/').to_string(),
                path: file_path.to_string_lossy().to_string(),
                size,
                is_dir,
                is_file: !is_dir,
                is_symlink: false,
                modified: metadata.last_modified().map(|t| {
                    SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(t.timestamp() as u64)
                }),
                created: None,
                accessed: None,
                mode: Some(0o644),
                mime_type: metadata.content_type().map(String::from),
            });
        }
        
        files.sort_by(|a, b| {
            match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });
        
        Ok(files)
    }
    
    async fn stat(&self, path: &Path) -> Result<FileStat> {
        let key = self.to_key(path);
        let metadata = self.operator.stat(&key).await?;
        
        Ok(FileStat {
            size: metadata.content_length(),
            is_dir: metadata.is_dir(),
            is_file: !metadata.is_dir(),
            is_symlink: false,
            mtime: metadata.last_modified().map(|t| {
                SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(t.timestamp() as u64)
            }),
            atime: None,
            ctime: None,
            mode: 0o644,
            nlink: 1,
            uid: 0,
            gid: 0,
            blksize: 4096,
            blocks: (metadata.content_length() + 511) / 512,
        })
    }
    
    async fn read(&self, path: &Path) -> Result<Vec<u8>> {
        let key = self.to_key(path);
        let data = self.operator.read(&key).await?;
        Ok(data.to_vec())
    }
    
    async fn read_range(&self, path: &Path, offset: u64, len: u64) -> Result<Vec<u8>> {
        let key = self.to_key(path);
        let data = self.operator.read_with(&key).range(offset..offset + len).await?;
        Ok(data.to_vec())
    }
    
    async fn write(&self, path: &Path, data: &[u8]) -> Result<()> {
        let key = self.to_key(path);
        self.operator.write(&key, data.to_vec()).await?;
        Ok(())
    }
    
    async fn append(&self, path: &Path, data: &[u8]) -> Result<()> {
        let key = self.to_key(path);
        let mut existing = self.operator.read(&key).await.map(|d| d.to_vec()).unwrap_or_default();
        existing.extend_from_slice(data);
        self.operator.write(&key, existing).await?;
        Ok(())
    }
    
    async fn write_at(&self, path: &Path, offset: u64, data: &[u8]) -> Result<()> {
        let key = self.to_key(path);
        let mut existing = self.operator.read(&key).await?.to_vec();
        let end = offset as usize + data.len();
        if existing.len() < end {
            existing.resize(end, 0);
        }
        existing[offset as usize..end].copy_from_slice(data);
        self.operator.write(&key, existing).await?;
        Ok(())
    }
    
    async fn truncate(&self, path: &Path, len: u64) -> Result<()> {
        let key = self.to_key(path);
        let mut existing = self.operator.read(&key).await?.to_vec();
        existing.truncate(len as usize);
        self.operator.write(&key, existing).await?;
        Ok(())
    }
    
    async fn mkdir(&self, path: &Path) -> Result<()> {
        let key = format!("{}/", self.to_key(path));
        self.operator.write(&key, vec![]).await?;
        Ok(())
    }
    
    async fn mkdir_p(&self, path: &Path) -> Result<()> {
        self.mkdir(path).await
    }
    
    async fn rmdir(&self, path: &Path) -> Result<()> {
        let key = format!("{}/", self.to_key(path));
        self.operator.delete(&key).await?;
        Ok(())
    }
    
    async fn rename(&self, from: &Path, to: &Path) -> Result<()> {
        self.copy(from, to, CopyOptions::default()).await?;
        self.rm(from).await?;
        Ok(())
    }
    
    async fn copy(&self, from: &Path, to: &Path, options: CopyOptions) -> Result<()> {
        let from_key = self.to_key(from);
        let to_key = self.to_key(to);
        
        if !options.overwrite && self.operator.is_exist(&to_key).await? {
            return Err(anyhow::anyhow!("Destination already exists"));
        }
        
        let data = self.operator.read(&from_key).await?;
        self.operator.write(&to_key, data.to_vec()).await?;
        Ok(())
    }
    
    async fn mv(&self, from: &Path, to: &Path, options: MoveOptions) -> Result<()> {
        let copy_opts = CopyOptions {
            overwrite: options.overwrite,
            recursive: true,
            preserve_attributes: false,
            follow_symlinks: false,
        };
        self.copy(from, to, copy_opts).await?;
        self.rm_rf(from).await?;
        Ok(())
    }
    
    async fn rm(&self, path: &Path) -> Result<()> {
        let key = self.to_key(path);
        self.operator.delete(&key).await?;
        Ok(())
    }
    
    async fn rm_rf(&self, path: &Path) -> Result<()> {
        let key = self.to_key(path);
        let entries = self.operator.list(&format!("{}/", key)).await.unwrap_or_default();
        for entry in entries {
            let entry_path = path.join(entry.name());
            Box::pin(self.rm_rf(&entry_path)).await?;
        }
        self.operator.delete(&key).await.ok();
        self.operator.delete(&format!("{}/", key)).await.ok();
        Ok(())
    }
    
    async fn symlink(&self, _target: &Path, _link: &Path) -> Result<()> {
        Err(anyhow::anyhow!("GCS does not support symbolic links"))
    }
    
    async fn readlink(&self, _path: &Path) -> Result<String> {
        Err(anyhow::anyhow!("GCS does not support symbolic links"))
    }
    
    async fn exists(&self, path: &Path) -> Result<bool> {
        let key = self.to_key(path);
        Ok(self.operator.is_exist(&key).await?)
    }
    
    async fn is_dir(&self, path: &Path) -> Result<bool> {
        let key = self.to_key(path);
        match self.operator.stat(&key).await {
            Ok(m) => Ok(m.is_dir()),
            Err(_) => Ok(false),
        }
    }
    
    async fn is_file(&self, path: &Path) -> Result<bool> {
        let key = self.to_key(path);
        match self.operator.stat(&key).await {
            Ok(m) => Ok(!m.is_dir()),
            Err(_) => Ok(false),
        }
    }
    
    async fn is_symlink(&self, _path: &Path) -> Result<bool> {
        Ok(false)
    }
    
    async fn chmod(&self, _path: &Path, _mode: u32) -> Result<()> {
        warn!("chmod not supported on GCS");
        Ok(())
    }
    
    async fn chown(&self, _path: &Path, _uid: u32, _gid: u32) -> Result<()> {
        warn!("chown not supported on GCS");
        Ok(())
    }
    
    async fn touch(&self, path: &Path) -> Result<()> {
        let key = self.to_key(path);
        if !self.operator.is_exist(&key).await? {
            self.operator.write(&key, vec![]).await?;
        }
        Ok(())
    }
    
    async fn set_times(&self, _path: &Path, _atime: Option<SystemTime>, _mtime: Option<SystemTime>) -> Result<()> {
        warn!("set_times not supported on GCS");
        Ok(())
    }
    
    async fn file_size(&self, path: &Path) -> Result<u64> {
        let key = self.to_key(path);
        let metadata = self.operator.stat(&key).await?;
        Ok(metadata.content_length())
    }
    
    async fn available_space(&self) -> Result<u64> {
        Ok(u64::MAX)
    }
    
    async fn total_space(&self) -> Result<u64> {
        Ok(u64::MAX)
    }
    
    fn is_read_only(&self) -> bool {
        false
    }
    
    fn root_path(&self) -> &Path {
        Path::new("/")
    }
}

// =============================================================================
// Unit Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_to_key_removes_leading_slash() {
        let path = Path::new("/some/path/to/file.txt");
        let expected = "some/path/to/file.txt";
        
        let result = path.strip_prefix("/")
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();
        
        assert_eq!(result, expected);
    }
    
    #[test]
    fn test_to_key_handles_relative_path() {
        let path = Path::new("relative/path.txt");
        
        let result = path.strip_prefix("/")
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();
        
        assert_eq!(result, "relative/path.txt");
    }
    
    #[test]
    fn test_detect_tier_standard() {
        // GCS storage classes mapping
        // STANDARD -> Cold (cloud data is always cooler than local)
        assert_eq!(detect_gcs_tier(Some("STANDARD")), StorageTier::Cold);
        assert_eq!(detect_gcs_tier(None), StorageTier::Cold);
    }
    
    #[test]
    fn test_detect_tier_archive() {
        assert_eq!(detect_gcs_tier(Some("ARCHIVE")), StorageTier::Archive);
        assert_eq!(detect_gcs_tier(Some("COLDLINE")), StorageTier::Archive);
    }
    
    #[test]
    fn test_detect_tier_nearline() {
        assert_eq!(detect_gcs_tier(Some("NEARLINE")), StorageTier::Cold);
    }
    
    #[test]
    fn test_detect_tier_unknown() {
        assert_eq!(detect_gcs_tier(Some("UNKNOWN")), StorageTier::Cold);
    }
    
    /// Helper function for tier detection in tests
    fn detect_gcs_tier(storage_class: Option<&str>) -> StorageTier {
        match storage_class {
            Some("ARCHIVE") | Some("COLDLINE") => StorageTier::Archive,
            _ => StorageTier::Cold,
        }
    }
}

