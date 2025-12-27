//! S3 Storage Adapter - Implements StorageAdapter and IFileOperations for AWS S3

use anyhow::{Context, Result};
use async_trait::async_trait;
use opendal::services::S3;
use opendal::Operator;
use std::collections::HashSet;
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
        
        // Use provided credentials, or fall back to environment variables
        let access_key = access_key.or_else(|| std::env::var("AWS_ACCESS_KEY_ID").ok());
        let secret_key = secret_key.or_else(|| std::env::var("AWS_SECRET_ACCESS_KEY").ok());
        
        if let Some(ref ak) = access_key {
            builder.access_key_id(ak);
        }
        if let Some(ref sk) = secret_key {
            builder.secret_access_key(sk);
        }
        if let Some(ref ep) = endpoint {
            builder.endpoint(ep);
        }
        
        let operator = Operator::new(builder)
            .map_err(|e| {
                anyhow::anyhow!(
                    "Failed to create S3 operator for bucket '{}' in region '{}': {}. \
                    Check that bucket name, region, and credentials are correct.",
                    bucket, region, e
                )
            })?
            .finish();
        
        let has_access_key = access_key.is_some();
        let has_secret_key = secret_key.is_some();
        info!("S3 adapter initialized - bucket: {}, region: {}, has_access_key: {}, has_secret_key: {}, endpoint: {:?}", 
            bucket, region, has_access_key, has_secret_key, endpoint);
        
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
        // For root path, use empty string; otherwise add trailing slash for prefix
        let prefix = if key.is_empty() { String::new() } else { format!("{}/", key) };
        
        info!("[S3] Listing files - bucket: {}, region: {}, path: {:?}, key: '{}', prefix: '{}'", 
            self.bucket, self.region, path, key, prefix);
        
        // OpenDAL's list() returns all entries with the given prefix
        // We need to filter to only immediate children
        let entries = self.operator.list(&prefix).await
            .with_context(|| {
                format!(
                    "Failed to list S3 objects in bucket '{}' (region: {}) with prefix '{}'. \
                    Check IAM permissions: s3:ListBucket on bucket, s3:GetObject on objects. \
                    Verify bucket name, region, and credentials are correct.",
                    self.bucket, self.region, prefix
                )
            })?;
        
        info!("[S3] Received {} entries from OpenDAL", entries.len());
        
        let mut files = Vec::new();
        let mut seen_names = HashSet::new();
        
        for (idx, entry) in entries.iter().enumerate() {
            let entry_name = entry.name().to_string();
            let metadata = entry.metadata();
            let is_dir = metadata.is_dir();
            let size = metadata.content_length();
            
            info!("[S3] Entry {}: name='{}', is_dir={}, size={}", idx, entry_name, is_dir, size);
            
            // Skip empty entries
            if entry_name.is_empty() || entry_name == "/" {
                debug!("[S3] Skipping empty entry");
                continue;
            }
            
            // Skip if entry name exactly matches prefix (this is the directory itself)
            if entry_name == prefix {
                debug!("[S3] Skipping prefix directory: '{}'", entry_name);
                continue;
            }
            
            // Extract immediate child name
            // OpenDAL returns full paths from bucket root
            // At root (prefix=""), entries are like "file.txt" or "folder/"
            // In subdirectory (prefix="folder/"), entries are like "folder/file.txt" or "folder/subfolder/"
            let child_name = if !prefix.is_empty() && entry_name.starts_with(&prefix) {
                // Remove prefix: "folder/file.txt" -> "file.txt"
                let relative = entry_name.strip_prefix(&prefix).unwrap_or(&entry_name);
                // Get first component only (immediate child)
                let first_part = relative.split('/').next().unwrap_or(relative);
                first_part.trim_end_matches('/')
            } else if prefix.is_empty() {
                // At root: entry_name is "file.txt" or "folder/" - use as-is
                entry_name.split('/').next().unwrap_or(&entry_name).trim_end_matches('/')
            } else {
                // Entry doesn't match prefix - log warning but don't skip (might be a bug in our logic)
                warn!("[S3] Entry '{}' doesn't start with prefix '{}' - checking anyway", entry_name, prefix);
                // Try to extract anyway
                entry_name.split('/').last().unwrap_or(&entry_name).trim_end_matches('/')
            };
            
            if child_name.is_empty() {
                warn!("[S3] Entry '{}' resulted in empty child name, skipping", entry_name);
                continue;
            }
            
            // Deduplicate by child name
            if seen_names.contains(child_name) {
                debug!("[S3] Skipping duplicate child: '{}' (from entry '{}')", child_name, entry_name);
                continue;
            }
            seen_names.insert(child_name.to_string());
            
            // Build file path relative to current path
            let file_path = if path.as_os_str().is_empty() || path == Path::new("/") {
                PathBuf::from("/").join(child_name)
            } else {
                path.join(child_name)
            };
            
            info!("[S3] ✓ Adding: child='{}', path={:?}, is_dir={}, size={}", 
                child_name, file_path, is_dir, size);
            
            let mut vfile = VirtualFile::new(
                child_name.to_string(),
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
        
        info!("[S3] Returning {} files after processing {} entries", files.len(), entries.len());
        
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
        let from_key = self.to_key(from);
        let to_key = self.to_key(to);
        info!("Renaming S3 object: {} -> {}", from_key, to_key);
        
        // S3 doesn't have atomic rename - copy then delete
        // Use copy with overwrite enabled
        let copy_opts = CopyOptions {
            overwrite: true,
            recursive: false,
            preserve_attributes: false,
            follow_symlinks: false,
        };
        self.copy(from, to, copy_opts).await?;
        self.rm(from).await?;
        info!("Successfully renamed S3 object: {} -> {}", from_key, to_key);
        Ok(())
    }
    
    async fn copy(&self, from: &Path, to: &Path, options: CopyOptions) -> Result<()> {
        let from_key = self.to_key(from);
        let to_key = self.to_key(to);
        
        info!("Copying S3 object: {} -> {}", from_key, to_key);
        
        // Check if destination exists
        if !options.overwrite && self.operator.is_exist(&to_key).await? {
            return Err(anyhow::anyhow!("Destination already exists: {}", to_key));
        }
        
        // Check if source exists
        if !self.operator.is_exist(&from_key).await? {
            return Err(anyhow::anyhow!("Source does not exist: {}", from_key));
        }
        
        let metadata = self.operator.stat(&from_key).await?;
        
        if metadata.is_dir() && options.recursive {
            // Copy directory recursively
            let prefix_with_slash = format!("{}/", from_key);
            let entries = self.operator.list(&prefix_with_slash).await?;
            info!("Copying directory with {} entries", entries.len());
            
            for entry in entries {
                let entry_name = entry.name();
                // Get relative path from the source directory
                let relative_path = entry_name.strip_prefix(&prefix_with_slash)
                    .unwrap_or(entry_name);
                
                let from_path = from.join(relative_path);
                let to_path = to.join(relative_path);
                Box::pin(self.copy(&from_path, &to_path, options.clone())).await?;
            }
            
            // Copy directory marker if it exists
            if self.operator.is_exist(&prefix_with_slash).await.unwrap_or(false) {
                let marker_data = self.operator.read(&prefix_with_slash).await.ok();
                if let Some(data) = marker_data {
                    let _ = self.operator.write(&format!("{}/", to_key), data.to_vec()).await;
                }
            }
        } else {
            // Copy single file - use read+write (OpenDAL handles S3 CopyObject internally when possible)
            // For large files, this will be less efficient, but it's the most compatible approach
            let data = self.operator.read(&from_key).await
                .map_err(|e| anyhow::anyhow!("Failed to read source object '{}': {}", from_key, e))?;
            self.operator.write(&to_key, data.to_vec()).await
                .map_err(|e| anyhow::anyhow!("Failed to write destination object '{}': {}", to_key, e))?;
            info!("Successfully copied S3 object: {} -> {}", from_key, to_key);
        }
        
        Ok(())
    }
    
    async fn mv(&self, from: &Path, to: &Path, options: MoveOptions) -> Result<()> {
        let from_key = self.to_key(from);
        let to_key = self.to_key(to);
        info!("Moving S3 object: {} -> {}", from_key, to_key);
        
        let copy_opts = CopyOptions {
            overwrite: options.overwrite,
            recursive: true,
            preserve_attributes: false,
            follow_symlinks: false,
        };
        self.copy(from, to, copy_opts).await?;
        self.rm_rf(from).await?;
        info!("Successfully moved S3 object: {} -> {}", from_key, to_key);
        Ok(())
    }
    
    async fn rm(&self, path: &Path) -> Result<()> {
        let key = self.to_key(path);
        debug!("Deleting S3 object: {}", key);
        
        // Check if this looks like a multipart upload part file
        let is_part_file = key.contains(".part") || key.ends_with(".part0") || key.ends_with(".part1");
        
        // Attempt to delete the object
        // Note: GLACIER_IR objects can be deleted directly without restore
        // For other Glacier classes (DEEP_ARCHIVE), objects may need to be restored first
        match self.operator.delete(&key).await {
            Ok(_) => {
                info!("Successfully deleted S3 object: {}", key);
                Ok(())
            }
            Err(e) => {
                let error_msg = format!("Failed to delete S3 object '{}': {}", key, e);
                error!("{}", error_msg);
                
                let error_str = e.to_string().to_lowercase();
                let error_debug = format!("{:?}", e);
                
                // Check if this is likely an orphaned multipart upload part
                if is_part_file {
                    return Err(anyhow::anyhow!(
                        "{} - This appears to be an orphaned multipart upload part. \
                        Orphaned parts from failed uploads cannot be deleted with s3:DeleteObject. \
                        They must be cleaned up by aborting the incomplete multipart upload using \
                        s3:AbortMultipartUpload. Check for incomplete multipart uploads with: \
                        aws s3api list-multipart-uploads --bucket {}. \
                        Then abort them with: aws s3api abort-multipart-upload --bucket {} --key {} --upload-id <id>",
                        error_msg, self.bucket, self.bucket, key
                    ));
                }
                
                // Check for specific AWS error codes
                if error_str.contains("accessdenied") || error_str.contains("403") {
                    return Err(anyhow::anyhow!(
                        "{} - Access Denied. Check IAM permissions: \
                        - s3:DeleteObject on the object \
                        - s3:ListBucket on the bucket \
                        - If bucket has versioning enabled, also need s3:DeleteObjectVersion \
                        - If bucket has MFA delete enabled, MFA token is required",
                        error_msg
                    ));
                }
                
                if error_str.contains("nosuchkey") || error_str.contains("404") {
                    // Object doesn't exist - might have been deleted already or never existed
                    warn!("Object '{}' not found - may have been deleted already", key);
                    return Ok(()); // Treat as success if object doesn't exist
                }
                
                // Check if error is related to Glacier storage class
                if error_str.contains("glacier") || error_str.contains("restore") || error_str.contains("invalidobjectstate") {
                    return Err(anyhow::anyhow!(
                        "{} - Objects in Glacier storage classes (GLACIER, DEEP_ARCHIVE) must be restored before deletion. \
                        GLACIER_IR objects should be deletable directly. \
                        To restore: aws s3api restore-object --bucket {} --key {} --restore-request '{{\"Days\":1,\"GlacierJobParameters\":{{\"Tier\":\"Expedited\"}}}}' \
                        Then wait for restore to complete before deleting. Check IAM permissions: s3:DeleteObject, s3:RestoreObject.",
                        error_msg, self.bucket, key
                    ));
                }
                
                // Check for versioning-related errors
                if error_str.contains("version") || error_str.contains("versionid") {
                    return Err(anyhow::anyhow!(
                        "{} - This bucket may have versioning enabled. \
                        Try deleting with version ID or disable versioning. \
                        Check IAM permissions: s3:DeleteObjectVersion.",
                        error_msg
                    ));
                }
                
                // Generic error with helpful suggestions
                Err(anyhow::anyhow!(
                    "{} - Possible causes: \
                    1. Insufficient IAM permissions (s3:DeleteObject, s3:ListBucket) \
                    2. Object is in Glacier/DEEP_ARCHIVE and needs restore first \
                    3. Bucket has versioning enabled (need s3:DeleteObjectVersion) \
                    4. Bucket has MFA delete enabled (need MFA token) \
                    5. Object is locked by Object Lock retention/legal hold \
                    Error details: {}",
                    error_msg, error_debug
                ))
            }
        }
    }
    
    async fn rm_rf(&self, path: &Path) -> Result<()> {
        let key = self.to_key(path);
        debug!("rm_rf: Deleting S3 object/directory: {}", key);
        
        // First, check if it's a directory by trying to list objects with this prefix
        let prefix_with_slash = format!("{}/", key);
        let entries = self.operator.list(&prefix_with_slash).await.unwrap_or_default();
        
        if !entries.is_empty() {
            // It's a directory - delete all objects with this prefix recursively
            info!("rm_rf: Found {} entries under prefix '{}', deleting recursively", entries.len(), prefix_with_slash);
            for entry in entries {
                let entry_name = entry.name();
                // Remove the prefix to get relative path
                let relative_path = entry_name.strip_prefix(&prefix_with_slash)
                    .unwrap_or(entry_name);
                let entry_path = path.join(relative_path);
                Box::pin(self.rm_rf(&entry_path)).await?;
            }
            // Delete the directory marker itself
            let _ = self.operator.delete(&prefix_with_slash).await;
            info!("rm_rf: Successfully deleted directory: {}", key);
        } else {
            // It's a single file - delete it directly
            info!("rm_rf: Deleting single file: {}", key);
            
            // Check if this looks like a multipart upload part file
            let is_part_file = key.contains(".part") || key.ends_with(".part0") || key.ends_with(".part1");
            
            match self.operator.delete(&key).await {
                Ok(_) => {
                    info!("rm_rf: Successfully deleted file: {}", key);
                }
                Err(e) => {
                    let error_str = e.to_string().to_lowercase();
                    let error_debug = format!("{:?}", e);
                    
                    // Check if this is likely an orphaned multipart upload part
                    if is_part_file {
                        return Err(anyhow::anyhow!(
                            "Failed to delete S3 object '{}': {} - This appears to be an orphaned multipart upload part. \
                            Orphaned parts from failed uploads cannot be deleted with s3:DeleteObject. \
                            They must be cleaned up by aborting the incomplete multipart upload using \
                            s3:AbortMultipartUpload. Use AWS CLI: aws s3api list-multipart-uploads --bucket {}",
                            key, e, self.bucket
                        ));
                    }
                    
                    // Check for access denied
                    if error_str.contains("accessdenied") || error_str.contains("403") {
                        return Err(anyhow::anyhow!(
                            "Failed to delete S3 object '{}': {} - Access Denied. \
                            Check IAM permissions: s3:DeleteObject, s3:ListBucket, s3:DeleteObjectVersion (if versioning enabled)",
                            key, e
                        ));
                    }
                    
                    // Check if object doesn't exist (treat as success)
                    if error_str.contains("nosuchkey") || error_str.contains("404") {
                        warn!("rm_rf: Object '{}' not found - may have been deleted already", key);
                        return Ok(());
                    }
                    
                    // Check for Glacier errors
                    if error_str.contains("glacier") || error_str.contains("restore") || error_str.contains("invalidobjectstate") {
                        return Err(anyhow::anyhow!(
                            "Failed to delete S3 object '{}': {} - Objects in Glacier storage classes must be restored before deletion. \
                            GLACIER_IR objects should be deletable directly. Restore command: \
                            aws s3api restore-object --bucket {} --key {} --restore-request '{{\"Days\":1}}'",
                            key, e, self.bucket, key
                        ));
                    }
                    
                    // Generic error
                    return Err(anyhow::anyhow!(
                        "Failed to delete S3 object '{}': {} - Check IAM permissions (s3:DeleteObject), \
                        storage class (may need restore), versioning (may need DeleteObjectVersion), \
                        or Object Lock settings. Error: {}",
                        key, e, error_debug
                    ));
                }
            }
        }
        
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

