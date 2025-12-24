//! Domain Entities - Core business objects with identity

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::SystemTime;

use super::value_objects::{FileSize, StorageTier, TierStatus};

/// Virtual File Entity - Represents a file in the VFS
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VirtualFile {
    /// Unique identifier
    pub id: String,
    
    /// File name
    pub name: String,
    
    /// Full path in VFS
    pub path: PathBuf,
    
    /// File size
    pub size: FileSize,
    
    /// MIME type
    pub content_type: Option<String>,
    
    /// Storage tier status
    pub tier_status: TierStatus,
    
    /// Last modified timestamp
    pub last_modified: SystemTime,
    
    /// Last accessed timestamp
    pub last_accessed: Option<SystemTime>,
    
    /// Is directory
    pub is_directory: bool,
    
    /// Is hidden file (starts with . on Unix, or has hidden attribute on Windows)
    pub is_hidden: Option<bool>,
    
    /// Can be transcoded (video files)
    pub transcodable: bool,
    
    /// Transcode status if applicable
    pub transcode_status: Option<TranscodeStatus>,
    
    /// User-assigned tags (e.g., "important", "work", "personal")
    pub tags: Vec<FileTag>,
    
    /// Is marked as favorite
    pub is_favorite: bool,
    
    /// Color label (like Finder tags)
    pub color_label: Option<ColorLabel>,
    
    /// User rating (0-5 stars)
    pub rating: Option<u8>,
    
    /// User comment/notes
    pub comment: Option<String>,
}

/// File tag with name and optional color
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct FileTag {
    /// Tag name
    pub name: String,
    /// Tag color (optional)
    pub color: Option<String>,
}

impl FileTag {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            color: None,
        }
    }
    
    pub fn with_color(name: impl Into<String>, color: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            color: Some(color.into()),
        }
    }
}

/// Color labels (similar to Finder/macOS tags)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ColorLabel {
    Red,
    Orange,
    Yellow,
    Green,
    Blue,
    Purple,
    Gray,
}

impl ColorLabel {
    pub fn as_str(&self) -> &'static str {
        match self {
            ColorLabel::Red => "red",
            ColorLabel::Orange => "orange",
            ColorLabel::Yellow => "yellow",
            ColorLabel::Green => "green",
            ColorLabel::Blue => "blue",
            ColorLabel::Purple => "purple",
            ColorLabel::Gray => "gray",
        }
    }
    
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "red" => Some(ColorLabel::Red),
            "orange" => Some(ColorLabel::Orange),
            "yellow" => Some(ColorLabel::Yellow),
            "green" => Some(ColorLabel::Green),
            "blue" => Some(ColorLabel::Blue),
            "purple" => Some(ColorLabel::Purple),
            "gray" | "grey" => Some(ColorLabel::Gray),
            _ => None,
        }
    }
    
    pub fn hex_color(&self) -> &'static str {
        match self {
            ColorLabel::Red => "#FF3B30",
            ColorLabel::Orange => "#FF9500",
            ColorLabel::Yellow => "#FFCC00",
            ColorLabel::Green => "#34C759",
            ColorLabel::Blue => "#007AFF",
            ColorLabel::Purple => "#AF52DE",
            ColorLabel::Gray => "#8E8E93",
        }
    }
}

impl VirtualFile {
    /// Create a new virtual file
    pub fn new(name: String, path: PathBuf, size: u64, is_directory: bool) -> Self {
        // Detect if file is hidden (Unix convention: starts with .)
        let is_hidden = name.starts_with('.');
        
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            path,
            size: FileSize::from_bytes(size),
            content_type: None,
            tier_status: TierStatus::default(),
            last_modified: SystemTime::now(),
            last_accessed: None,
            is_directory,
            is_hidden: Some(is_hidden),
            transcodable: false,
            transcode_status: None,
            tags: Vec::new(),
            is_favorite: false,
            color_label: None,
            rating: None,
            comment: None,
        }
    }
    
    /// Add a tag to the file
    pub fn add_tag(&mut self, tag: FileTag) {
        if !self.tags.contains(&tag) {
            self.tags.push(tag);
        }
    }
    
    /// Remove a tag from the file
    pub fn remove_tag(&mut self, tag_name: &str) {
        self.tags.retain(|t| t.name != tag_name);
    }
    
    /// Check if file has a specific tag
    pub fn has_tag(&self, tag_name: &str) -> bool {
        self.tags.iter().any(|t| t.name == tag_name)
    }
    
    /// Toggle favorite status
    pub fn toggle_favorite(&mut self) {
        self.is_favorite = !self.is_favorite;
    }
    
    /// Set color label
    pub fn set_color_label(&mut self, color: Option<ColorLabel>) {
        self.color_label = color;
    }
    
    /// Set rating (clamped to 0-5)
    pub fn set_rating(&mut self, rating: Option<u8>) {
        self.rating = rating.map(|r| r.min(5));
    }
    
    /// Check if file needs hydration (is in cold storage)
    pub fn needs_hydration(&self) -> bool {
        matches!(self.tier_status.current_tier, StorageTier::Cold | StorageTier::Nearline | StorageTier::Archive)
    }
    
    /// Check if file is a video that can be transcoded
    pub fn can_transcode(&self) -> bool {
        if self.is_directory {
            return false;
        }
        
        let video_extensions = ["mp4", "mov", "mkv", "avi", "webm", "m4v", "wmv"];
        self.path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| video_extensions.contains(&ext.to_lowercase().as_str()))
            .unwrap_or(false)
    }
    
    /// Mark file as hydrated
    pub fn mark_hydrated(&mut self) {
        self.tier_status.current_tier = StorageTier::Hot;
        self.tier_status.is_cached = true;
        self.last_accessed = Some(SystemTime::now());
    }
}

/// Storage Source Entity - Represents a connected storage backend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageSource {
    /// Unique identifier
    pub id: String,
    
    /// Display name
    pub name: String,
    
    /// Source type
    pub source_type: StorageSourceType,
    
    /// Connection status
    pub status: ConnectionStatus,
    
    /// Is mounted
    pub mounted: bool,
    
    /// Mount point if mounted
    pub mount_point: Option<PathBuf>,
    
    /// Configuration
    pub config: StorageConfig,
}

/// Storage category for grouping providers
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum StorageCategory {
    Local,      // Local filesystem
    Cloud,      // Cloud object storage (S3, GCS, Azure Blob, etc.)
    Block,      // Block storage (EBS, Azure Disk, FSx, etc.)
    Network,    // Network shares (NFS, SMB, CIFS, AFP)
    Hybrid,     // Hybrid solutions (FSx ONTAP, NetApp, etc.)
    Custom,     // User-defined / plugins
}

/// Dynamic storage provider identifier
/// Uses String to support any provider without code changes
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct ProviderId(pub String);

impl ProviderId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }
    
    pub fn as_str(&self) -> &str {
        &self.0
    }
    
    // Built-in provider IDs (constants for convenience)
    pub const LOCAL: &'static str = "local";
    pub const AWS_S3: &'static str = "aws-s3";
    pub const GCS: &'static str = "gcs";
    pub const AZURE_BLOB: &'static str = "azure-blob";
    pub const S3_COMPATIBLE: &'static str = "s3-compatible";
    pub const FSX_ONTAP: &'static str = "fsx-ontap";
    pub const NFS: &'static str = "nfs";
    pub const SMB: &'static str = "smb";
    pub const SFTP: &'static str = "sftp";
    pub const WEBDAV: &'static str = "webdav";
}

impl From<&str> for ProviderId {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

impl From<String> for ProviderId {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl std::fmt::Display for ProviderId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Legacy enum for backward compatibility
/// New code should use ProviderId for dynamic providers
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum StorageSourceType {
    // Built-in types (for backward compat)
    S3,
    FsxN,
    FsxOntap,
    Local,
    Block,
    Gcs,
    Nas,
    Smb,
    Nfs,
    Sftp,
    WebDav,
    AzureBlob,
    S3Compatible,
    // Dynamic provider (for extensibility)
    Custom(String),
}

impl StorageSourceType {
    /// Convert to ProviderId
    pub fn to_provider_id(&self) -> ProviderId {
        match self {
            StorageSourceType::Local => ProviderId::new(ProviderId::LOCAL),
            StorageSourceType::S3 => ProviderId::new(ProviderId::AWS_S3),
            StorageSourceType::Gcs => ProviderId::new(ProviderId::GCS),
            StorageSourceType::AzureBlob => ProviderId::new(ProviderId::AZURE_BLOB),
            StorageSourceType::S3Compatible => ProviderId::new(ProviderId::S3_COMPATIBLE),
            StorageSourceType::FsxN | StorageSourceType::FsxOntap => ProviderId::new(ProviderId::FSX_ONTAP),
            StorageSourceType::Nfs => ProviderId::new(ProviderId::NFS),
            StorageSourceType::Smb | StorageSourceType::Nas => ProviderId::new(ProviderId::SMB),
            StorageSourceType::Sftp => ProviderId::new(ProviderId::SFTP),
            StorageSourceType::WebDav => ProviderId::new(ProviderId::WEBDAV),
            StorageSourceType::Block => ProviderId::new("block"),
            StorageSourceType::Custom(id) => ProviderId::new(id.clone()),
        }
    }
    
    /// Get storage category
    pub fn category(&self) -> StorageCategory {
        match self {
            StorageSourceType::Local => StorageCategory::Local,
            StorageSourceType::S3 | StorageSourceType::Gcs | StorageSourceType::AzureBlob | StorageSourceType::S3Compatible => StorageCategory::Cloud,
            StorageSourceType::Block => StorageCategory::Block,
            StorageSourceType::Nfs | StorageSourceType::Smb | StorageSourceType::Nas | StorageSourceType::Sftp | StorageSourceType::WebDav => StorageCategory::Network,
            StorageSourceType::FsxN | StorageSourceType::FsxOntap => StorageCategory::Hybrid,
            StorageSourceType::Custom(_) => StorageCategory::Custom,
        }
    }
    
    /// Create from provider ID string
    pub fn from_provider_id(id: &str) -> Self {
        match id {
            "local" => StorageSourceType::Local,
            "aws-s3" => StorageSourceType::S3,
            "gcs" => StorageSourceType::Gcs,
            "azure-blob" => StorageSourceType::AzureBlob,
            "s3-compatible" => StorageSourceType::S3Compatible,
            "fsx-ontap" => StorageSourceType::FsxOntap,
            "nfs" => StorageSourceType::Nfs,
            "smb" => StorageSourceType::Smb,
            "sftp" => StorageSourceType::Sftp,
            "webdav" => StorageSourceType::WebDav,
            "block" => StorageSourceType::Block,
            other => StorageSourceType::Custom(other.to_string()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConnectionStatus {
    Connected,
    Disconnected,
    Error(String),
    Connecting,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    /// S3 bucket or local path
    pub path_or_bucket: String,
    
    /// Region (for cloud storage)
    pub region: Option<String>,
    
    /// Endpoint override
    pub endpoint: Option<String>,
    
    /// Access credentials
    pub access_key: Option<String>,
    pub secret_key: Option<String>,
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self {
            path_or_bucket: String::new(),
            region: None,
            endpoint: None,
            access_key: None,
            secret_key: None,
        }
    }
}

/// Transcode status for video files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscodeStatus {
    pub state: TranscodeState,
    pub progress: u8,
    pub output_format: String,
    pub output_path: Option<PathBuf>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TranscodeState {
    Pending,
    InProgress,
    Completed,
    Error,
}

/// Cache Entry Entity - Represents a cached file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    /// File path in VFS
    pub path: PathBuf,
    
    /// Local cache path
    pub cache_path: PathBuf,
    
    /// File size
    pub size: u64,
    
    /// When it was cached
    pub cached_at: SystemTime,
    
    /// Last access time
    pub last_accessed: SystemTime,
    
    /// Access count (for LFU eviction)
    pub access_count: u64,
}

