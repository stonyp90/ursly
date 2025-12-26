//! S3 Storage Adapter - Implements StorageAdapter and IFileOperations for AWS S3

use anyhow::{Context, Result};
use async_trait::async_trait;
use opendal::services::S3;
use opendal::Operator;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tracing::{debug, error, info, warn};

use crate::vfs::domain::{VirtualFile, StorageSourceType, TierStatus, StorageTier};
use crate::vfs::ports::{
    StorageAdapter, IFileOperations, FileEntry, FileStat, CopyOptions, MoveOptions
};

/// S3 storage adapter using OpenDAL
pub struct S3StorageAdapter {
    /// OpenDAL operator
    operator: Operator,
    
    /// Bucket name
    bucket: String,
    
    /// Display name
    name: String,
    
    /// Region
    region: String,
}

impl S3StorageAdapter {
    pub async fn new(
        bucket: String,
        region: String,
        access_key: Option<String>,
        secret_key: Option<String>,
        endpoint: Option<String>,
        name: String,
    ) -> Result<Self> {
        let mut builder = S3::default();
        builder.bucket(&bucket);
        builder.region(&region);
        
        if let Some(ak) = access_key {
            builder.access_key_id(&ak);
        }
        if let Some(sk) = secret_key {
            builder.secret_access_key(&sk);
        }
        if let Some(ep) = endpoint {
            builder.endpoint(&ep);
        }
        
        let operator = Operator::new(builder)?
            .finish();
        
        info!("S3 adapter initialized for bucket: {}", bucket);
        
        Ok(Self {
            operator,
            bucket,
            name,
            region,
        })
    }
    
    /// Get the OpenDAL operator (for multipart uploads)
    pub fn operator(&self) -> &Operator {
        &self.operator
    }
    
    /// Convert path to S3 key
    fn to_key(&self, path: &Path) -> String {
        path.strip_prefix("/")
            .unwrap_or(path)
            .to_string_lossy()
            .to_string()
    }
    
    /// Detect storage tier from S3 storage class
    pub fn detect_tier(storage_class: Option<&str>) -> StorageTier {
        match storage_class {
            Some("STANDARD") | None => StorageTier::Cold, // S3 Standard is still "cold" vs local
            Some("INTELLIGENT_TIERING") => StorageTier::Cold,
            Some("STANDARD_IA") | Some("ONEZONE_IA") => StorageTier::Cold,
            Some("GLACIER") | Some("GLACIER_IR") => StorageTier::Archive,
            Some("DEEP_ARCHIVE") => StorageTier::Archive,
            _ => StorageTier::Cold,
        }
    }
}

#[async_trait]
impl StorageAdapter for S3StorageAdapter {
    fn storage_type(&self) -> StorageSourceType {
        StorageSourceType::S3
    }
    
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn test_connection(&self) -> Result<bool> {
        // Try to list bucket root to verify access
        match self.operator.list("/").await {
            Ok(_) => Ok(true),
            Err(e) => {
                error!("S3 connection test failed: {}", e);
                Ok(false)
            }
        }
    }
    
    async fn list_files(&self, path: &Path) -> Result<Vec<VirtualFile>> {
        let key = self.to_key(path);
        let prefix = if key.is_empty() { String::new() } else { format!("{}/", key) };
        
        debug!("Listing S3 objects with prefix: {}", prefix);
        
        let entries = self.operator.list(&prefix).await?;
        let mut files = Vec::new();
        
        for entry in entries {
            let name = entry.name().to_string();
            
            // Skip the directory itself
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
            
            // S3 objects are "cold" until hydrated
            vfile.tier_status = TierStatus {
                current_tier: StorageTier::Cold,
                is_cached: false,
                can_warm: true,
                retrieval_time_estimate: Some(5), // Estimate 5 seconds for S3
            };
            
            vfile.transcodable = vfile.can_transcode();
            
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
        let key = self.to_key(path);
        debug!("Reading S3 object: {}", key);
        
        let data = self.operator.read(&key).await?;
        Ok(data.to_vec())
    }
    
    async fn read_file_range(&self, path: &Path, offset: u64, length: u64) -> Result<Vec<u8>> {
        let key = self.to_key(path);
        debug!("Reading S3 object range: {} (offset={}, length={})", key, offset, length);
        
        // Use range read with opendal
        let data = self.operator
            .read_with(&key)
            .range(offset..offset + length)
            .await?;
        Ok(data.to_vec())
    }
    
    async fn write_file(&self, path: &Path, data: &[u8]) -> Result<()> {
        let key = self.to_key(path);
        debug!("Writing S3 object: {}", key);
        
        self.operator.write(&key, data.to_vec()).await?;
        Ok(())
    }
    
    async fn get_metadata(&self, path: &Path) -> Result<VirtualFile> {
        let key = self.to_key(path);
        let metadata = self.operator.stat(&key).await?;
        
        let name = path
            .file_name()
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
        
        vfile.transcodable = vfile.can_transcode();
        
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
        // S3 doesn't have real directories, but we can create a zero-byte object
        self.operator.write(&key, vec![]).await?;
        Ok(())
    }
    
    async fn file_size(&self, path: &Path) -> Result<u64> {
        let key = self.to_key(path);
        let metadata = self.operator.stat(&key).await?;
        Ok(metadata.content_length())
    }
}

// =============================================================================
// IFileOperations Implementation for S3
// =============================================================================

#[async_trait]
impl IFileOperations for S3StorageAdapter {
    async fn list(&self, path: &Path) -> Result<Vec<FileEntry>> {
        let key = self.to_key(path);
        let prefix = if key.is_empty() { String::new() } else { format!("{}/", key) };
        
        debug!("Listing S3 objects with prefix: {}", prefix);
        
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
            
            let file_entry = FileEntry {
                name: name.trim_end_matches('/').to_string(),
                path: file_path.to_string_lossy().to_string(),
                size,
                is_dir,
                is_file: !is_dir,
                is_symlink: false, // S3 doesn't have symlinks
                modified: metadata.last_modified().map(|t| {
                    SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(t.timestamp() as u64)
                }),
                created: None,
                accessed: None,
                mode: Some(0o644),
                mime_type: metadata.content_type().map(String::from),
            };
            
            files.push(file_entry);
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
        debug!("Reading S3 object: {}", key);
        let data = self.operator.read(&key).await?;
        Ok(data.to_vec())
    }
    
    async fn read_range(&self, path: &Path, offset: u64, len: u64) -> Result<Vec<u8>> {
        let key = self.to_key(path);
        let data = self.operator
            .read_with(&key)
            .range(offset..offset + len)
            .await?;
        Ok(data.to_vec())
    }
    
    async fn write(&self, path: &Path, data: &[u8]) -> Result<()> {
        let key = self.to_key(path);
        debug!("Writing S3 object: {}", key);
        self.operator.write(&key, data.to_vec()).await?;
        Ok(())
    }
    
    async fn append(&self, path: &Path, data: &[u8]) -> Result<()> {
        // S3 doesn't support append, so we need to read + append + write
        let key = self.to_key(path);
        let mut existing = match self.operator.read(&key).await {
            Ok(d) => d.to_vec(),
            Err(_) => Vec::new(),
        };
        existing.extend_from_slice(data);
        self.operator.write(&key, existing).await?;
        Ok(())
    }
    
    async fn write_at(&self, path: &Path, offset: u64, data: &[u8]) -> Result<()> {
        // S3 doesn't support partial writes
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
        // S3 doesn't have real directories - create a placeholder
        let key = format!("{}/", self.to_key(path));
        self.operator.write(&key, vec![]).await?;
        Ok(())
    }
    
    async fn mkdir_p(&self, path: &Path) -> Result<()> {
        // Same as mkdir for S3
        self.mkdir(path).await
    }
    
    async fn rmdir(&self, path: &Path) -> Result<()> {
        let key = format!("{}/", self.to_key(path));
        self.operator.delete(&key).await?;
        Ok(())
    }
    
    async fn rename(&self, from: &Path, to: &Path) -> Result<()> {
        // S3 doesn't have rename - copy then delete
        self.copy(from, to, CopyOptions::default()).await?;
        self.rm(from).await?;
        Ok(())
    }
    
    async fn copy(&self, from: &Path, to: &Path, options: CopyOptions) -> Result<()> {
        let from_key = self.to_key(from);
        let to_key = self.to_key(to);
        
        // Check if destination exists
        if !options.overwrite && self.operator.is_exist(&to_key).await? {
            return Err(anyhow::anyhow!("Destination already exists"));
        }
        
        let metadata = self.operator.stat(&from_key).await?;
        
        if metadata.is_dir() && options.recursive {
            // Copy directory recursively
            let entries = self.operator.list(&from_key).await?;
            for entry in entries {
                let entry_name = entry.name();
                let from_path = from.join(entry_name);
                let to_path = to.join(entry_name);
                Box::pin(self.copy(&from_path, &to_path, options.clone())).await?;
            }
        } else {
            // Copy single file
            let data = self.operator.read(&from_key).await?;
            self.operator.write(&to_key, data.to_vec()).await?;
        }
        
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
        
        // Delete all objects with this prefix
        let entries = self.operator.list(&format!("{}/", key)).await.unwrap_or_default();
        for entry in entries {
            let entry_path = path.join(entry.name());
            Box::pin(self.rm_rf(&entry_path)).await?;
        }
        
        // Delete the object/directory marker itself
        self.operator.delete(&key).await.ok();
        self.operator.delete(&format!("{}/", key)).await.ok();
        
        Ok(())
    }
    
    async fn symlink(&self, _target: &Path, _link: &Path) -> Result<()> {
        Err(anyhow::anyhow!("S3 does not support symbolic links"))
    }
    
    async fn readlink(&self, _path: &Path) -> Result<String> {
        Err(anyhow::anyhow!("S3 does not support symbolic links"))
    }
    
    async fn exists(&self, path: &Path) -> Result<bool> {
        let key = self.to_key(path);
        Ok(self.operator.is_exist(&key).await?)
    }
    
    async fn is_dir(&self, path: &Path) -> Result<bool> {
        let key = self.to_key(path);
        match self.operator.stat(&key).await {
            Ok(m) => Ok(m.is_dir()),
            Err(_) => {
                // Try with trailing slash
                match self.operator.stat(&format!("{}/", key)).await {
                    Ok(m) => Ok(m.is_dir()),
                    Err(_) => Ok(false),
                }
            }
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
        Ok(false) // S3 doesn't have symlinks
    }
    
    async fn chmod(&self, _path: &Path, _mode: u32) -> Result<()> {
        warn!("chmod is not supported on S3");
        Ok(())
    }
    
    async fn chown(&self, _path: &Path, _uid: u32, _gid: u32) -> Result<()> {
        warn!("chown is not supported on S3");
        Ok(())
    }
    
    async fn touch(&self, path: &Path) -> Result<()> {
        let key = self.to_key(path);
        if !self.operator.is_exist(&key).await? {
            self.operator.write(&key, vec![]).await?;
        }
        // S3 doesn't support updating mtime without rewriting
        Ok(())
    }
    
    async fn set_times(&self, _path: &Path, _atime: Option<SystemTime>, _mtime: Option<SystemTime>) -> Result<()> {
        warn!("set_times is not supported on S3");
        Ok(())
    }
    
    async fn file_size(&self, path: &Path) -> Result<u64> {
        let key = self.to_key(path);
        let metadata = self.operator.stat(&key).await?;
        Ok(metadata.content_length())
    }
    
    async fn available_space(&self) -> Result<u64> {
        // S3 has virtually unlimited space
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
        // Create a mock operator - we can't easily test with real S3 but can test helpers
        let path = Path::new("/some/path/to/file.txt");
        let expected = "some/path/to/file.txt";
        
        // Test the logic directly
        let result = path.strip_prefix("/")
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();
        
        assert_eq!(result, expected);
    }
    
    #[test]
    fn test_to_key_handles_no_leading_slash() {
        let path = Path::new("relative/path.txt");
        
        let result = path.strip_prefix("/")
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();
        
        assert_eq!(result, "relative/path.txt");
    }
    
    #[test]
    fn test_detect_tier_standard() {
        assert_eq!(S3StorageAdapter::detect_tier(Some("STANDARD")), StorageTier::Cold);
        assert_eq!(S3StorageAdapter::detect_tier(None), StorageTier::Cold);
    }
    
    #[test]
    fn test_detect_tier_glacier() {
        assert_eq!(S3StorageAdapter::detect_tier(Some("GLACIER")), StorageTier::Archive);
        assert_eq!(S3StorageAdapter::detect_tier(Some("GLACIER_IR")), StorageTier::Archive);
        assert_eq!(S3StorageAdapter::detect_tier(Some("DEEP_ARCHIVE")), StorageTier::Archive);
    }
    
    #[test]
    fn test_detect_tier_infrequent_access() {
        assert_eq!(S3StorageAdapter::detect_tier(Some("STANDARD_IA")), StorageTier::Cold);
        assert_eq!(S3StorageAdapter::detect_tier(Some("ONEZONE_IA")), StorageTier::Cold);
        assert_eq!(S3StorageAdapter::detect_tier(Some("INTELLIGENT_TIERING")), StorageTier::Cold);
    }
    
    #[test]
    fn test_detect_tier_unknown() {
        assert_eq!(S3StorageAdapter::detect_tier(Some("UNKNOWN")), StorageTier::Cold);
    }
}

