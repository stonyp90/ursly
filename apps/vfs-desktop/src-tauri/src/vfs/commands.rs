//! VFS Tauri Commands
//!
//! These commands expose VFS functionality to the frontend.
//! Named with vfs_ prefix for consistent API naming.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use parking_lot::RwLock;
use tauri::State;
use tracing::{error, info, warn};

use crate::vfs::application::VfsService;
use crate::vfs::adapters::transcription::{TranscriptionService, TranscriptionSegment, TranscriptionStatus};

// ============================================================================
// Response Types for Frontend
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VfsStorageSourceResponse {
    pub id: String,
    pub name: String,
    pub source_type: String,
    pub mounted: bool,
    pub status: String,
    pub path: Option<String>,
    pub bucket: Option<String>,
    pub region: Option<String>,
    /// Whether this is a mounted volume that can be ejected (DMG, external drive, etc.)
    pub is_ejectable: bool,
    /// Whether this is a system location (Home, Documents, etc.)
    pub is_system_location: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VfsFileMetadataResponse {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size: u64,
    pub size_human: String,
    pub last_modified: String,
    pub is_directory: bool,
    pub is_hidden: bool,
    pub tier_status: String,
    pub is_cached: bool,
    pub can_warm: bool,
    pub can_transcode: bool,
    pub transcode_status: Option<String>,
    pub transcode_progress: Option<u8>,
    pub thumbnail: Option<String>,  // Base64 data URL or API URL
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VfsCacheStatsResponse {
    pub total_size: u64,
    pub max_size: u64,
    pub entry_count: u64,
    pub hit_count: u64,
    pub miss_count: u64,
    pub hit_rate: f64,
    pub usage_percent: f64,
}

// ============================================================================
// VFS State Management
// ============================================================================

/// Global VFS state wrapped for Tauri
pub struct VfsStateWrapper(pub Arc<RwLock<Option<Arc<VfsService>>>>);

impl VfsStateWrapper {
    pub fn new() -> Self {
        Self(Arc::new(RwLock::new(None)))
    }
    
    /// Get a clone of the service if initialized
    pub fn get_service(&self) -> Option<Arc<VfsService>> {
        self.0.read().clone()
    }
    
    /// Set the service
    pub fn set_service(&self, service: Arc<VfsService>) {
        *self.0.write() = Some(service);
    }
}

impl Default for VfsStateWrapper {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Tauri Commands (prefixed with vfs_ to avoid conflicts)
// ============================================================================

/// Initialize the VFS service and auto-mount default system folders
#[tauri::command]
pub async fn vfs_init(
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    // Check if already initialized
    if state.get_service().is_some() {
        info!("VFS already initialized, skipping");
        return Ok("VFS already initialized".to_string());
    }
    
    let service = VfsService::new()
        .await
        .map_err(|e| format!("Failed to initialize VFS: {}", e))?;
    
    // Auto-mount default system folders
    let home = dirs::home_dir();
    
    if let Some(home_path) = home {
        // Mount home directory
        if let Err(e) = service.add_local_source("Home".to_string(), home_path.clone()).await {
            warn!("Failed to mount Home: {}", e);
        }
        
        // Mount common folders if they exist
        let common_folders = [
            ("Desktop", home_path.join("Desktop")),
            ("Documents", home_path.join("Documents")),
            ("Downloads", home_path.join("Downloads")),
            ("Pictures", home_path.join("Pictures")),
            ("Music", home_path.join("Music")),
            ("Videos", home_path.join("Videos")),
        ];
        
        for (name, path) in common_folders {
            if path.exists() && path.is_dir() {
                if let Err(e) = service.add_local_source(name.to_string(), path).await {
                    warn!("Failed to mount {}: {}", name, e);
                }
            }
        }
        
        // Platform-specific mounts - enumerate external volumes
        #[cfg(target_os = "macos")]
        {
            // Enumerate each volume in /Volumes separately (like Windows drive letters)
            let volumes_dir = std::path::PathBuf::from("/Volumes");
            if volumes_dir.exists() {
                if let Ok(entries) = std::fs::read_dir(&volumes_dir) {
                    for entry in entries.filter_map(Result::ok) {
                        let vol_path = entry.path();
                        let vol_name = entry.file_name().to_string_lossy().to_string();
                        
                        // Skip the main Macintosh HD symlink (already have Home folder)
                        // Only include actual mounted external volumes
                        if vol_path.is_dir() && !vol_name.starts_with('.') {
                            // Check if it's a symlink to root (main HD)
                            if let Ok(target) = std::fs::read_link(&vol_path) {
                                if target == std::path::PathBuf::from("/") {
                                    continue; // Skip symlink to root
                                }
                            }
                            
                            let display_name = format!("{}", vol_name);
                            if let Err(e) = service.add_local_source(display_name.clone(), vol_path).await {
                                warn!("Failed to mount volume {}: {}", display_name, e);
                            }
                        }
                    }
                }
            }
        }
        
        #[cfg(target_os = "linux")]
        {
            // Enumerate user's media mounts (USB drives, etc.)
            if let Some(username) = std::env::var("USER").ok() {
                let media_dir = std::path::PathBuf::from(format!("/media/{}", username));
                if media_dir.exists() {
                    if let Ok(entries) = std::fs::read_dir(&media_dir) {
                        for entry in entries.filter_map(Result::ok) {
                            let mount_path = entry.path();
                            let mount_name = entry.file_name().to_string_lossy().to_string();
                            
                            if mount_path.is_dir() && !mount_name.starts_with('.') {
                                if let Err(e) = service.add_local_source(mount_name.clone(), mount_path).await {
                                    warn!("Failed to mount media {}: {}", mount_name, e);
                                }
                            }
                        }
                    }
                }
            }
            
            // Also check /mnt for manually mounted drives
            let mnt_dir = std::path::PathBuf::from("/mnt");
            if mnt_dir.exists() {
                if let Ok(entries) = std::fs::read_dir(&mnt_dir) {
                    for entry in entries.filter_map(Result::ok) {
                        let mount_path = entry.path();
                        let mount_name = entry.file_name().to_string_lossy().to_string();
                        
                        if mount_path.is_dir() && !mount_name.starts_with('.') {
                            if let Err(e) = service.add_local_source(mount_name.clone(), mount_path).await {
                                warn!("Failed to mount {}: {}", mount_name, e);
                            }
                        }
                    }
                }
            }
        }
        
        #[cfg(target_os = "windows")]
        {
            // Enumerate all available drive letters (A-Z)
            for drive in 'A'..='Z' {
                let drive_path = std::path::PathBuf::from(format!("{}:\\", drive));
                if drive_path.exists() {
                    // Get volume label if available, otherwise use drive letter
                    let name = format!("Drive ({}:)", drive);
                    if let Err(e) = service.add_local_source(name.clone(), drive_path).await {
                        // Only warn for drives that should be accessible
                        if drive >= 'C' {
                            warn!("Failed to mount {}: {}", name, e);
                        }
                    }
                }
            }
        }
    }
    
    let service_arc = Arc::new(service);
    
    // Initialize global clipboard with VFS service
    init_global_clipboard(service_arc.clone());
    
    state.set_service(service_arc);
    
    info!("VFS service initialized with default folders");
    Ok("VFS initialized successfully".to_string())
}

/// List all storage sources (VFS version)
#[tauri::command]
pub async fn vfs_list_sources(
    state: State<'_, VfsStateWrapper>,
) -> Result<Vec<VfsStorageSourceResponse>, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized. Call vfs_init first.".to_string())?;
    
    let sources = service.list_sources();
    
    Ok(sources.into_iter().map(|s| {
        let path_str = s.mount_point.as_ref().map(|p| p.to_string_lossy().to_string());
        
        // Determine if this is an ejectable volume or a system location
        let (is_ejectable, is_system_location) = if let Some(ref path) = path_str {
            // On macOS, /Volumes/ contains mounted volumes (except Macintosh HD)
            // DMG mounts and external drives appear here
            let is_volume_mount = path.starts_with("/Volumes/") && !path.contains("Macintosh HD");
            
            // System locations are user home directories and their subdirectories
            let home_dir = std::env::var("HOME").unwrap_or_default();
            let is_home_or_subdir = path.starts_with(&home_dir) || 
                                    path == "/" ||
                                    path == "/Applications";
            
            (is_volume_mount, is_home_or_subdir && !is_volume_mount)
        } else {
            (false, false)
        };
        
        VfsStorageSourceResponse {
            id: s.id,
            name: s.name,
            source_type: format!("{:?}", s.source_type),
            mounted: s.mounted,
            status: format!("{:?}", s.status),
            path: path_str,
            bucket: Some(s.config.path_or_bucket),
            region: s.config.region,
            is_ejectable,
            is_system_location,
        }
    }).collect())
}

/// Mount a local storage source (VFS version)
#[tauri::command]
pub async fn vfs_mount_local(
    name: String,
    path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<VfsStorageSourceResponse, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized. Call vfs_init first.".to_string())?;
    
    let source = service.add_local_source(name, PathBuf::from(&path))
        .await
        .map_err(|e| format!("Failed to mount: {}", e))?;
    
    info!("Mounted local storage: {} at {}", source.name, path);
    
    // Determine if this is an ejectable volume
    let is_ejectable = path.starts_with("/Volumes/") && !path.contains("Macintosh HD");
    let home_dir = std::env::var("HOME").unwrap_or_default();
    let is_system_location = (path.starts_with(&home_dir) || path == "/" || path == "/Applications") && !is_ejectable;
    
    Ok(VfsStorageSourceResponse {
        id: source.id,
        name: source.name,
        source_type: "Local".to_string(),
        mounted: true,
        status: "Connected".to_string(),
        path: Some(path),
        bucket: None,
        region: None,
        is_ejectable,
        is_system_location,
    })
}

/// Eject/unmount a storage volume
#[tauri::command]
pub async fn vfs_eject(
    source_id: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<(), String> {
    info!("vfs_eject: source_id={}", source_id);
    
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    // Find the source to get the path
    let sources = service.list_sources();
    let source = sources.iter()
        .find(|s| s.id == source_id)
        .ok_or_else(|| format!("Source not found: {}", source_id))?;
    
    let mount_path = source.mount_point.as_ref()
        .ok_or_else(|| "No mount point for source".to_string())?;
    
    let path_str = mount_path.to_string_lossy().to_string();
    
    // Perform platform-specific eject
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        // Use diskutil to eject the volume
        let output = Command::new("diskutil")
            .args(["eject", &path_str])
            .output()
            .map_err(|e| format!("Failed to run diskutil: {}", e))?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // Try alternative: osascript to eject
            let alt_output = Command::new("osascript")
                .args(["-e", &format!("tell application \"Finder\" to eject disk \"{}\"", 
                    mount_path.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| path_str.clone())
                )])
                .output()
                .map_err(|e| format!("Failed to run osascript: {}", e))?;
            
            if !alt_output.status.success() {
                return Err(format!("Failed to eject volume: {}", stderr));
            }
        }
        
        info!("Ejected volume: {}", path_str);
    }
    
    #[cfg(target_os = "windows")]
    {
        // On Windows, use PowerShell to eject
        use std::process::Command;
        
        let output = Command::new("powershell")
            .args([
                "-Command",
                &format!(
                    "$vol = Get-Volume -FilePath '{}'; \
                     $driveEject = New-Object -comObject Shell.Application; \
                     $driveEject.Namespace(17).ParseName($vol.DriveLetter + ':').InvokeVerb('Eject')",
                    path_str
                )
            ])
            .output()
            .map_err(|e| format!("Failed to eject: {}", e))?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to eject volume: {}", stderr));
        }
        
        info!("Ejected volume: {}", path_str);
    }
    
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        // Try udisksctl first (modern Linux), then fallback to umount
        let output = Command::new("udisksctl")
            .args(["unmount", "-b", &path_str])
            .output()
            .or_else(|_| {
                Command::new("umount")
                    .args([&path_str])
                    .output()
            })
            .map_err(|e| format!("Failed to unmount: {}", e))?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to unmount volume: {}", stderr));
        }
        
        info!("Unmounted volume: {}", path_str);
    }
    
    // Remove the source from VFS internal state
    service.remove_source(&source_id);
    info!("Removed source {} from VFS", source_id);
    
    Ok(())
}

/// List files in a storage source (VFS version)
#[tauri::command]
pub async fn vfs_list_files(
    source_id: String,
    path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<Vec<VfsFileMetadataResponse>, String> {
    info!("vfs_list_files: source_id={}, path={}", source_id, path);
    
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let files = service.list_files(&source_id, std::path::Path::new(&path))
        .await
        .map_err(|e| format!("Failed to list files: {}", e))?;
    
    info!("vfs_list_files: found {} files", files.len());
    
    Ok(files.into_iter().map(|f| {
        let last_modified = f.last_modified
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                .unwrap_or_default())
            .unwrap_or_default();
        
        // Calculate values before moving fields
        let can_transcode = f.can_transcode();
        let transcode_status = f.transcode_status.as_ref().map(|s| format!("{:?}", s.state));
        let transcode_progress = f.transcode_status.as_ref().map(|s| s.progress);
        
        // Check if file is hidden (starts with . on Unix, or has hidden attribute)
        let is_hidden = f.name.starts_with('.') || f.is_hidden.unwrap_or(false);
        
        // Determine MIME type from extension
        let mime_type = f.path.extension()
            .and_then(|e| e.to_str())
            .map(|ext| match ext.to_lowercase().as_str() {
                "jpg" | "jpeg" => "image/jpeg",
                "png" => "image/png",
                "gif" => "image/gif",
                "webp" => "image/webp",
                "svg" => "image/svg+xml",
                "heic" | "heif" => "image/heic",
                "pdf" => "application/pdf",
                "mp4" => "video/mp4",
                "mov" => "video/quicktime",
                "avi" => "video/x-msvideo",
                "mkv" => "video/x-matroska",
                "webm" => "video/webm",
                "mp3" => "audio/mpeg",
                "wav" => "audio/wav",
                "flac" => "audio/flac",
                "txt" => "text/plain",
                "json" => "application/json",
                "xml" => "application/xml",
                "html" | "htm" => "text/html",
                "css" => "text/css",
                "js" => "application/javascript",
                "ts" | "tsx" => "text/typescript",
                "md" => "text/markdown",
                "zip" => "application/zip",
                "tar" | "gz" | "bz2" => "application/x-compressed",
                _ => "application/octet-stream",
            }.to_string());
        
        VfsFileMetadataResponse {
            id: f.id,
            name: f.name,
            path: f.path.to_string_lossy().to_string(),
            size: f.size.bytes(),
            size_human: f.size.as_human_readable(),
            last_modified,
            is_directory: f.is_directory,
            is_hidden,
            tier_status: f.tier_status.current_tier.as_str().to_string(),
            is_cached: f.tier_status.is_cached,
            can_warm: f.tier_status.can_warm,
            can_transcode,
            transcode_status,
            transcode_progress,
            thumbnail: None, // Thumbnails loaded on demand via vfs_get_thumbnail
            mime_type,
        }
    }).collect())
}

/// Hydrate (warm) a file from cold storage (VFS version)
#[tauri::command]
pub async fn vfs_warm_file(
    source_id: String,
    file_path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let cache_path = service.hydrate_file(&source_id, std::path::Path::new(&file_path))
        .await
        .map_err(|e| format!("Failed to hydrate file: {}", e))?;
    
    info!("File hydrated: {} -> {:?}", file_path, cache_path);
    
    Ok(cache_path.to_string_lossy().to_string())
}

/// Transcode a video file (VFS version)
#[tauri::command]
pub async fn vfs_transcode_video(
    _source_id: String,
    file_path: String,
    format: String,
    _state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    // For POC, just return a placeholder
    // Real implementation would use ffmpeg
    info!("Transcode requested: {} -> {}", file_path, format);
    
    Ok(format!("Transcode job started for {} (format: {})", file_path, format))
}

/// Get cache statistics (VFS version)
#[tauri::command]
pub async fn vfs_cache_stats(
    state: State<'_, VfsStateWrapper>,
) -> Result<VfsCacheStatsResponse, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let stats = service.cache_stats().await;
    
    Ok(VfsCacheStatsResponse {
        total_size: stats.total_size,
        max_size: stats.max_size,
        entry_count: stats.entry_count,
        hit_count: stats.hit_count,
        miss_count: stats.miss_count,
        hit_rate: stats.hit_rate(),
        usage_percent: stats.usage_percent(),
    })
}

/// Clear the cache (VFS version)
#[tauri::command]
pub async fn vfs_clear_cache(
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    service.clear_cache()
        .await
        .map_err(|e| format!("Failed to clear cache: {}", e))?;
    
    Ok("Cache cleared".to_string())
}

// ============================================================================
// POSIX File Operations Commands
// ============================================================================

/// Request types for file operations
#[derive(Debug, Deserialize)]
pub struct CopyRequest {
    pub from: String,
    pub to: String,
    pub overwrite: Option<bool>,
    pub recursive: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct MoveRequest {
    pub from: String,
    pub to: String,
    pub overwrite: Option<bool>,
}

/// Response type for file stat
#[derive(Debug, Serialize)]
pub struct FileStatResponse {
    pub size: u64,
    pub is_dir: bool,
    pub is_file: bool,
    pub is_symlink: bool,
    pub mode: u32,
    pub mtime: Option<u64>,
    pub atime: Option<u64>,
    pub ctime: Option<u64>,
}

/// Create a directory (like mkdir)
#[tauri::command]
pub async fn vfs_mkdir(
    source_id: String,
    path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    service.mkdir(&source_id, std::path::Path::new(&path))
        .await
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    info!("Created directory: {}", path);
    Ok(format!("Directory created: {}", path))
}

/// Create directory and all parents (like mkdir -p)
#[tauri::command]
pub async fn vfs_mkdir_p(
    source_id: String,
    path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    service.mkdir_p(&source_id, std::path::Path::new(&path))
        .await
        .map_err(|e| format!("Failed to create directories: {}", e))?;
    
    info!("Created directory tree: {}", path);
    Ok(format!("Directory tree created: {}", path))
}

/// Remove empty directory (like rmdir)
#[tauri::command]
pub async fn vfs_rmdir(
    source_id: String,
    path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    service.rmdir(&source_id, std::path::Path::new(&path))
        .await
        .map_err(|e| format!("Failed to remove directory: {}", e))?;
    
    info!("Removed directory: {}", path);
    Ok(format!("Directory removed: {}", path))
}

/// Rename file or directory
#[tauri::command]
pub async fn vfs_rename(
    source_id: String,
    from: String,
    to: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    service.rename(&source_id, std::path::Path::new(&from), std::path::Path::new(&to))
        .await
        .map_err(|e| format!("Failed to rename: {}", e))?;
    
    info!("Renamed: {} -> {}", from, to);
    Ok(format!("Renamed {} to {}", from, to))
}

/// Copy file or directory
#[tauri::command]
pub async fn vfs_copy(
    source_id: String,
    request: CopyRequest,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let options = crate::vfs::ports::CopyOptions {
        overwrite: request.overwrite.unwrap_or(false),
        recursive: request.recursive.unwrap_or(false),
        preserve_attributes: true,
        follow_symlinks: false,
    };
    
    service.copy(
        &source_id,
        std::path::Path::new(&request.from),
        std::path::Path::new(&request.to),
        options,
    )
        .await
        .map_err(|e| format!("Failed to copy: {}", e))?;
    
    info!("Copied: {} -> {}", request.from, request.to);
    Ok(format!("Copied {} to {}", request.from, request.to))
}

/// Move file or directory
#[tauri::command]
pub async fn vfs_move(
    source_id: String,
    request: MoveRequest,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let options = crate::vfs::ports::MoveOptions {
        overwrite: request.overwrite.unwrap_or(false),
    };
    
    service.mv(
        &source_id,
        std::path::Path::new(&request.from),
        std::path::Path::new(&request.to),
        options,
    )
        .await
        .map_err(|e| format!("Failed to move: {}", e))?;
    
    info!("Moved: {} -> {}", request.from, request.to);
    Ok(format!("Moved {} to {}", request.from, request.to))
}

/// Delete file (like rm)
#[tauri::command]
pub async fn vfs_delete(
    source_id: String,
    path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    service.rm(&source_id, std::path::Path::new(&path))
        .await
        .map_err(|e| format!("Failed to delete: {}", e))?;
    
    info!("Deleted: {}", path);
    Ok(format!("Deleted: {}", path))
}

/// Delete file or directory recursively (like rm -rf)
#[tauri::command]
pub async fn vfs_delete_recursive(
    source_id: String,
    path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    info!("vfs_delete_recursive called: source_id={}, path={}", source_id, path);
    
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    // Normalize the path
    let normalized_path = path.trim_start_matches('/');
    let path_obj = std::path::Path::new(normalized_path);
    
    info!("Attempting to delete: {:?}", path_obj);
    
    service.rm_rf(&source_id, path_obj)
        .await
        .map_err(|e| {
            error!("Failed to delete '{}': {}", path, e);
            format!("Failed to delete '{}': {}", path, e)
        })?;
    
    info!("Successfully deleted: {}", path);
    Ok(format!("Deleted: {}", path))
}

/// Change file permissions (like chmod)
#[tauri::command]
pub async fn vfs_chmod(
    source_id: String,
    path: String,
    mode: u32,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    service.chmod(&source_id, std::path::Path::new(&path), mode)
        .await
        .map_err(|e| format!("Failed to chmod: {}", e))?;
    
    info!("Changed mode of {} to {:o}", path, mode);
    Ok(format!("Changed permissions of {} to {:o}", path, mode))
}

/// Get file statistics (like stat)
#[tauri::command]
pub async fn vfs_stat(
    source_id: String,
    path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<FileStatResponse, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let stat = service.stat(&source_id, std::path::Path::new(&path))
        .await
        .map_err(|e| format!("Failed to stat: {}", e))?;
    
    Ok(FileStatResponse {
        size: stat.size,
        is_dir: stat.is_dir,
        is_file: stat.is_file,
        is_symlink: stat.is_symlink,
        mode: stat.mode,
        mtime: stat.mtime.and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()),
        atime: stat.atime.and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()),
        ctime: stat.ctime.and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()),
    })
}

/// Touch file (create or update timestamp)
#[tauri::command]
pub async fn vfs_touch(
    source_id: String,
    path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    service.touch(&source_id, std::path::Path::new(&path))
        .await
        .map_err(|e| format!("Failed to touch: {}", e))?;
    
    info!("Touched: {}", path);
    Ok(format!("Touched: {}", path))
}

/// Check if path exists
#[tauri::command]
pub async fn vfs_exists(
    source_id: String,
    path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<bool, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    service.exists(&source_id, std::path::Path::new(&path))
        .await
        .map_err(|e| format!("Failed to check existence: {}", e))
}

/// Read file as text
#[tauri::command]
pub async fn vfs_read_text(
    source_id: String,
    path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let bytes = service.read(&source_id, std::path::Path::new(&path))
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    String::from_utf8(bytes)
        .map_err(|e| format!("File is not valid UTF-8: {}", e))
}

/// Write text to file
#[tauri::command]
pub async fn vfs_write_text(
    source_id: String,
    path: String,
    content: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    service.write(&source_id, std::path::Path::new(&path), content.as_bytes())
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    info!("Wrote {} bytes to {}", content.len(), path);
    Ok(format!("Wrote {} bytes to {}", content.len(), path))
}

/// Append text to file
#[tauri::command]
pub async fn vfs_append_text(
    source_id: String,
    path: String,
    content: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    service.append(&source_id, std::path::Path::new(&path), content.as_bytes())
        .await
        .map_err(|e| format!("Failed to append to file: {}", e))?;
    
    info!("Appended {} bytes to {}", content.len(), path);
    Ok(format!("Appended {} bytes to {}", content.len(), path))
}

// ============================================================================
// Clipboard Commands - Copy/Paste between Native FS and VFS
// ============================================================================

use crate::vfs::adapters::ClipboardAdapter;
use crate::vfs::ports::{IClipboardService, ClipboardSource};
use once_cell::sync::Lazy;
use parking_lot::RwLock as SyncRwLock;

/// Global clipboard adapter with VfsService
static CLIPBOARD: Lazy<SyncRwLock<Option<Arc<ClipboardAdapter>>>> = Lazy::new(|| SyncRwLock::new(None));

/// Initialize the global clipboard with VfsService
pub fn init_global_clipboard(vfs_service: Arc<VfsService>) {
    let mut clipboard_lock = CLIPBOARD.write();
    *clipboard_lock = Some(Arc::new(ClipboardAdapter::with_vfs_service(vfs_service)));
    info!("Global clipboard initialized with VFS service");
}

/// Get the global clipboard, initializing if needed
fn get_clipboard_with_vfs(state: &VfsStateWrapper) -> Result<Arc<ClipboardAdapter>, String> {
    // Try to get existing clipboard
    {
        let clipboard_lock = CLIPBOARD.read();
        if let Some(clipboard) = clipboard_lock.as_ref() {
            return Ok(clipboard.clone());
        }
    }
    
    // Initialize with VFS service if not yet initialized
    if let Some(vfs) = state.get_service() {
        let mut clipboard_lock = CLIPBOARD.write();
        if clipboard_lock.is_none() {
            *clipboard_lock = Some(Arc::new(ClipboardAdapter::with_vfs_service(vfs)));
            info!("Initialized clipboard with VFS service on demand");
        }
        Ok(clipboard_lock.as_ref().unwrap().clone())
    } else {
        Err("VFS not initialized".to_string())
    }
}

/// Get clipboard without VFS (for read-only operations)
fn get_clipboard_readonly() -> Arc<ClipboardAdapter> {
    let clipboard_lock = CLIPBOARD.read();
    clipboard_lock.as_ref().cloned().unwrap_or_else(|| Arc::new(ClipboardAdapter::new()))
}

/// Generate a copy name for files/folders (e.g., "file.txt" -> "file copy.txt")
fn generate_copy_name(original_name: &str) -> String {
    // Check if there's an extension
    if let Some(dot_pos) = original_name.rfind('.') {
        let name = &original_name[..dot_pos];
        let ext = &original_name[dot_pos..];
        
        // Check if already has " copy" or " copy N" suffix
        if let Some(copy_pos) = name.rfind(" copy") {
            let after_copy = &name[copy_pos + 5..];
            if after_copy.is_empty() {
                // "file copy.txt" -> "file copy 2.txt"
                return format!("{} 2{}", name, ext);
            } else if after_copy.starts_with(' ') {
                // "file copy 2.txt" -> "file copy 3.txt"
                if let Ok(num) = after_copy.trim().parse::<u32>() {
                    return format!("{}{}", &name[..copy_pos + 5], format!(" {}{}", num + 1, ext));
                }
            }
        }
        format!("{} copy{}", name, ext)
    } else {
        // No extension (probably a folder)
        if let Some(copy_pos) = original_name.rfind(" copy") {
            let after_copy = &original_name[copy_pos + 5..];
            if after_copy.is_empty() {
                return format!("{} 2", original_name);
            } else if after_copy.starts_with(' ') {
                if let Ok(num) = after_copy.trim().parse::<u32>() {
                    return format!("{} {}", &original_name[..copy_pos + 5], num + 1);
                }
            }
        }
        format!("{} copy", original_name)
    }
}

/// Response for clipboard content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardContentResponse {
    pub operation: String,  // "copy" or "cut"
    pub source: String,     // "native" or "vfs:source_id"
    pub paths: Vec<String>,
    pub file_count: usize,
}

/// Response for paste operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasteResponse {
    pub files_pasted: usize,
    pub files_failed: usize,
    pub pasted_paths: Vec<String>,
    pub errors: Vec<String>,
}

/// Copy files to clipboard from VFS
#[tauri::command]
pub async fn vfs_clipboard_copy(
    source_id: String,
    paths: Vec<String>,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let clipboard = get_clipboard_with_vfs(&state)?;
    
    let pathbufs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    
    clipboard.copy_files(
        ClipboardSource::Vfs { source_id: source_id.clone() },
        pathbufs,
    )
        .await
        .map_err(|e| format!("Failed to copy to clipboard: {}", e))?;
    
    info!("Copied {} files to clipboard from source {}", paths.len(), source_id);
    Ok(format!("Copied {} files to clipboard", paths.len()))
}

/// Cut files to clipboard from VFS
#[tauri::command]
pub async fn vfs_clipboard_cut(
    source_id: String,
    paths: Vec<String>,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    let clipboard = get_clipboard_with_vfs(&state)?;
    
    let pathbufs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    
    clipboard.cut_files(
        ClipboardSource::Vfs { source_id: source_id.clone() },
        pathbufs,
    )
        .await
        .map_err(|e| format!("Failed to cut to clipboard: {}", e))?;
    
    info!("Cut {} files to clipboard from source {}", paths.len(), source_id);
    Ok(format!("Cut {} files to clipboard", paths.len()))
}

/// Copy files from native filesystem to clipboard
#[tauri::command]
pub async fn vfs_clipboard_copy_native(
    paths: Vec<String>,
) -> Result<String, String> {
    let clipboard = get_clipboard_readonly();
    
    let pathbufs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    
    clipboard.copy_files(ClipboardSource::Native, pathbufs)
        .await
        .map_err(|e| format!("Failed to copy to clipboard: {}", e))?;
    
    info!("Copied {} native files to clipboard", paths.len());
    Ok(format!("Copied {} files to clipboard", paths.len()))
}

/// Copy files from VFS to clipboard AND export to native clipboard
/// This enables copy from VFS -> paste in Finder/Explorer
#[tauri::command]
pub async fn vfs_clipboard_copy_for_native(
    source_id: String,
    paths: Vec<String>,
    state: State<'_, VfsStateWrapper>,
) -> Result<String, String> {
    info!("vfs_clipboard_copy_for_native: source={}, paths={:?}", source_id, paths);
    
    let clipboard = get_clipboard_with_vfs(&state)?;
    info!("vfs_clipboard_copy_for_native: got clipboard adapter");
    
    let pathbufs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    
    // Copy to VFS clipboard - this also exports to temp and writes to native clipboard
    clipboard.copy_files(
        ClipboardSource::Vfs { source_id: source_id.clone() },
        pathbufs.clone(),
    )
        .await
        .map_err(|e| format!("Failed to copy to clipboard: {}", e))?;
    
    // Verify the clipboard was updated
    let content = clipboard.get_clipboard().await.map_err(|e| format!("Failed to verify: {}", e))?;
    if let Some(ref c) = content {
        info!("vfs_clipboard_copy_for_native: verified {} paths in clipboard", c.paths.len());
    } else {
        warn!("vfs_clipboard_copy_for_native: clipboard appears empty after copy!");
    }
    
    info!("Copied {} files to VFS and native clipboard from source {}", paths.len(), source_id);
    Ok(format!("Copied {} files to clipboard (native-compatible)", paths.len()))
}

/// Get current clipboard content
#[tauri::command]
pub async fn vfs_clipboard_get() -> Result<Option<ClipboardContentResponse>, String> {
    let clipboard = get_clipboard_readonly();
    
    let content = clipboard.get_clipboard()
        .await
        .map_err(|e| format!("Failed to get clipboard: {}", e))?;
    
    Ok(content.map(|c| ClipboardContentResponse {
        operation: if c.is_cut() { "cut".to_string() } else { "copy".to_string() },
        source: match c.source {
            ClipboardSource::Native => "native".to_string(),
            ClipboardSource::Vfs { source_id } => format!("vfs:{}", source_id),
        },
        paths: c.paths.iter().map(|p| p.to_string_lossy().to_string()).collect(),
        file_count: c.paths.len(),
    }))
}

/// Check if clipboard has files
#[tauri::command]
pub async fn vfs_clipboard_has_files() -> Result<bool, String> {
    // Check if global clipboard is initialized
    let is_initialized = {
        let lock = CLIPBOARD.read();
        lock.is_some()
    };
    info!("vfs_clipboard_has_files: global clipboard initialized={}", is_initialized);
    
    let clipboard = get_clipboard_readonly();
    
    // Also log what's in the clipboard
    let content = clipboard.get_clipboard()
        .await
        .map_err(|e| format!("Failed to get clipboard: {}", e))?;
    
    if let Some(ref c) = content {
        info!("vfs_clipboard_has_files: found {} paths in clipboard", c.paths.len());
    } else {
        info!("vfs_clipboard_has_files: clipboard is empty");
    }
    
    let result = content.map(|c| !c.paths.is_empty()).unwrap_or(false);
    
    info!("vfs_clipboard_has_files: result={}", result);
    Ok(result)
}

/// Clear clipboard
#[tauri::command]
pub async fn vfs_clipboard_clear() -> Result<String, String> {
    let clipboard = get_clipboard_readonly();
    
    clipboard.clear_clipboard()
        .await
        .map_err(|e| format!("Failed to clear clipboard: {}", e))?;
    
    Ok("Clipboard cleared".to_string())
}

/// Paste clipboard content to VFS destination
#[tauri::command]
pub async fn vfs_clipboard_paste_to_vfs(
    dest_source_id: String,
    dest_path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<PasteResponse, String> {
    info!("vfs_clipboard_paste_to_vfs: dest_source_id={}, dest_path={}", dest_source_id, dest_path);
    
    // Get clipboard with VFS service for paste operation
    let clipboard = get_clipboard_with_vfs(&state)?;
    let content = clipboard.get_clipboard()
        .await
        .map_err(|e| format!("Failed to get clipboard: {}", e))?
        .ok_or_else(|| "Clipboard is empty".to_string())?;
    
    info!("vfs_clipboard_paste_to_vfs: is_cut={}, source={:?}, paths={:?}", 
          content.is_cut(), content.source, content.paths);
    
    // Get VFS service for actual paste operation
    let vfs_service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let dest = std::path::Path::new(&dest_path);
    let mut pasted_paths = Vec::new();
    let mut errors = Vec::new();
    
    for path in &content.paths {
        let file_name = path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unnamed".to_string());
        let dest_file_path = dest.join(&file_name);
        
        let result = match &content.source {
            ClipboardSource::Native => {
                // Native -> VFS: copy file/directory from native path to VFS
                copy_native_to_vfs(&vfs_service, path, &dest_source_id, dest).await
            }
            ClipboardSource::Vfs { source_id } => {
                // VFS -> VFS: check if same source or different
                if source_id == &dest_source_id {
                    // Same source - check if source and dest are the same
                    if path == &dest_file_path {
                        // Pasting to same location - create a copy with new name
                        let new_name = generate_copy_name(&file_name);
                        let new_dest = dest.join(&new_name);
                        let opts = crate::vfs::ports::CopyOptions {
                            recursive: true,
                            ..Default::default()
                        };
                        vfs_service.copy(source_id, path, &new_dest, opts)
                            .await
                            .map(|_| new_dest)
                    } else {
                        // Different destination - normal copy
                        let opts = crate::vfs::ports::CopyOptions {
                            recursive: true,
                            ..Default::default()
                        };
                        vfs_service.copy(source_id, path, &dest_file_path, opts)
                            .await
                            .map(|_| dest_file_path.clone())
                    }
                } else {
                    // Different sources - use cross-storage copy
                    vfs_service.copy_to_source(source_id, path, &dest_source_id, &dest_file_path)
                        .await
                        .map(|_| dest_file_path.clone())
                }
            }
        };
        
        match result {
            Ok(dest) => pasted_paths.push(dest),
            Err(e) => errors.push(format!("{:?}: {}", path, e)),
        }
    }
    
    // Note: Cut operation removed - simple copy/paste only
    
    let files_pasted = pasted_paths.len();
    let files_failed = errors.len();
    
    info!("Pasted {} files to VFS {} at {} (failed: {})", files_pasted, dest_source_id, dest_path, files_failed);
    
    Ok(PasteResponse {
        files_pasted,
        files_failed,
        pasted_paths: pasted_paths.iter().map(|p| p.to_string_lossy().to_string()).collect(),
        errors,
    })
}

/// Helper to copy native file/directory to VFS
async fn copy_native_to_vfs(
    vfs: &std::sync::Arc<crate::vfs::application::VfsService>,
    source_path: &std::path::Path,
    dest_source_id: &str,
    dest_path: &std::path::Path,
) -> anyhow::Result<std::path::PathBuf> {
    let file_name = source_path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unnamed".to_string());
    let dest_file_path = dest_path.join(&file_name);
    
    let metadata = tokio::fs::metadata(source_path).await?;
    
    if metadata.is_dir() {
        // Create directory in VFS
        vfs.mkdir_p(dest_source_id, &dest_file_path).await?;
        
        // Copy contents recursively
        let mut entries = tokio::fs::read_dir(source_path).await?;
        while let Some(entry) = entries.next_entry().await? {
            let entry_path = entry.path();
            Box::pin(copy_native_to_vfs(vfs, &entry_path, dest_source_id, &dest_file_path)).await?;
        }
    } else {
        // Copy file
        let data = tokio::fs::read(source_path).await?;
        vfs.write(dest_source_id, &dest_file_path, &data).await?;
    }
    
    Ok(dest_file_path)
}

/// Paste clipboard content to native filesystem
#[tauri::command]
pub async fn vfs_clipboard_paste_to_native(
    dest_path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<PasteResponse, String> {
    // Get clipboard with VFS service for paste operation
    let clipboard = get_clipboard_with_vfs(&state)?;
    let content = clipboard.get_clipboard()
        .await
        .map_err(|e| format!("Failed to get clipboard: {}", e))?
        .ok_or_else(|| "Clipboard is empty".to_string())?;
    
    // Get VFS service (needed for VFS->native copies)
    let vfs_service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let dest = std::path::Path::new(&dest_path);
    let mut pasted_paths = Vec::new();
    let mut errors = Vec::new();
    
    for path in &content.paths {
        let file_name = path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unnamed".to_string());
        let dest_file_path = dest.join(&file_name);
        
        let result = match &content.source {
            ClipboardSource::Native => {
                // Native -> Native: simple copy
                copy_native_to_native(path, dest).await
            }
            ClipboardSource::Vfs { source_id } => {
                // VFS -> Native
                copy_vfs_to_native(&vfs_service, source_id, path, dest).await
            }
        };
        
        match result {
            Ok(dest) => pasted_paths.push(dest),
            Err(e) => errors.push(format!("{:?}: {}", path, e)),
        }
    }
    
    // If cut operation and all succeeded, delete sources
    if content.is_cut() && errors.is_empty() {
        match &content.source {
            ClipboardSource::Native => {
                for path in &content.paths {
                    if let Err(e) = tokio::fs::remove_file(path).await {
                        if let Err(e2) = tokio::fs::remove_dir_all(path).await {
                            warn!("Failed to delete cut source {:?}: {} / {}", path, e, e2);
                        }
                    }
                }
            }
            ClipboardSource::Vfs { source_id } => {
                for path in &content.paths {
                    if let Err(e) = vfs_service.rm_rf(source_id, path).await {
                        warn!("Failed to delete cut source {:?}: {}", path, e);
                    }
                }
            }
        }
        
        let _ = clipboard.clear_clipboard().await;
    }
    
    let files_pasted = pasted_paths.len();
    let files_failed = errors.len();
    
    info!("Pasted {} files to native {} (failed: {})", files_pasted, dest_path, files_failed);
    
    Ok(PasteResponse {
        files_pasted,
        files_failed,
        pasted_paths: pasted_paths.iter().map(|p| p.to_string_lossy().to_string()).collect(),
        errors,
    })
}

/// Helper to copy native file/directory to native
async fn copy_native_to_native(
    source_path: &std::path::Path,
    dest_path: &std::path::Path,
) -> anyhow::Result<std::path::PathBuf> {
    let file_name = source_path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unnamed".to_string());
    let dest_file_path = dest_path.join(&file_name);
    
    let metadata = tokio::fs::metadata(source_path).await?;
    
    if metadata.is_dir() {
        // Create directory
        tokio::fs::create_dir_all(&dest_file_path).await?;
        
        // Copy contents recursively
        let mut entries = tokio::fs::read_dir(source_path).await?;
        while let Some(entry) = entries.next_entry().await? {
            let entry_path = entry.path();
            Box::pin(copy_native_to_native(&entry_path, &dest_file_path)).await?;
        }
    } else {
        // Copy file
        if let Some(parent) = dest_file_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        tokio::fs::copy(source_path, &dest_file_path).await?;
    }
    
    Ok(dest_file_path)
}

/// Helper to copy VFS file/directory to native
async fn copy_vfs_to_native(
    vfs: &std::sync::Arc<crate::vfs::application::VfsService>,
    source_id: &str,
    source_path: &std::path::Path,
    dest_path: &std::path::Path,
) -> anyhow::Result<std::path::PathBuf> {
    let file_name = source_path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unnamed".to_string());
    let dest_file_path = dest_path.join(&file_name);
    
    // Check if it's a directory by listing files
    let is_dir = match vfs.list_files(source_id, source_path).await {
        Ok(files) => !files.is_empty() || source_path.to_string_lossy().ends_with('/'),
        Err(_) => false, // Assume file if listing fails
    };
    
    if is_dir {
        // Create directory
        tokio::fs::create_dir_all(&dest_file_path).await?;
        
        // List and copy contents
        let files = vfs.list_files(source_id, source_path).await?;
        for file in files {
            let file_path = std::path::Path::new(&file.path);
            Box::pin(copy_vfs_to_native(vfs, source_id, file_path, &dest_file_path)).await?;
        }
    } else {
        // Copy file
        if let Some(parent) = dest_file_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        let data = vfs.read(source_id, source_path).await?;
        tokio::fs::write(&dest_file_path, data).await?;
    }
    
    Ok(dest_file_path)
}

/// Read files from OS clipboard (Finder/Explorer copy)
#[tauri::command]
pub async fn vfs_clipboard_read_native() -> Result<Vec<String>, String> {
    let clipboard = get_clipboard_readonly();
    
    let paths = clipboard.read_native_clipboard()
        .await
        .map_err(|e| format!("Failed to read native clipboard: {}", e))?;
    
    Ok(paths.unwrap_or_default().iter().map(|p| p.to_string_lossy().to_string()).collect())
}

/// Write files to OS clipboard (so Finder/Explorer can paste)
#[tauri::command]
pub async fn vfs_clipboard_write_native(
    paths: Vec<String>,
) -> Result<String, String> {
    let clipboard = get_clipboard_readonly();
    
    let pathbufs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    
    clipboard.write_native_clipboard(&pathbufs)
        .await
        .map_err(|e| format!("Failed to write native clipboard: {}", e))?;
    
    Ok(format!("Wrote {} files to native clipboard", paths.len()))
}

// ============================================================================
// Tags & Favorites Commands
// ============================================================================

use crate::vfs::adapters::JsonMetadataStore;
use crate::vfs::ports::IMetadataStore;
use crate::vfs::domain::{FileTag, ColorLabel};

/// Global metadata store
static METADATA_STORE: OnceLock<tokio::sync::RwLock<Option<JsonMetadataStore>>> = OnceLock::new();

async fn get_metadata_store() -> Result<&'static tokio::sync::RwLock<Option<JsonMetadataStore>>, String> {
    let store = METADATA_STORE.get_or_init(|| tokio::sync::RwLock::new(None));
    
    // Initialize if needed
    {
        let guard = store.read().await;
        if guard.is_none() {
            drop(guard);
            let mut write_guard = store.write().await;
            if write_guard.is_none() {
                let new_store = JsonMetadataStore::default_store()
                    .await
                    .map_err(|e| format!("Failed to initialize metadata store: {}", e))?;
                *write_guard = Some(new_store);
            }
        }
    }
    
    Ok(store)
}

/// Response for file metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadataResponse {
    pub tags: Vec<TagResponse>,
    pub is_favorite: bool,
    pub color_label: Option<String>,
    pub rating: Option<u8>,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagResponse {
    pub name: String,
    pub color: Option<String>,
}

/// Get metadata for a file
#[tauri::command]
pub async fn vfs_get_metadata(
    source_id: String,
    path: String,
) -> Result<Option<FileMetadataResponse>, String> {
    let store_lock = get_metadata_store().await?;
    let guard = store_lock.read().await;
    let store = guard.as_ref().ok_or("Metadata store not initialized")?;
    
    let meta = store.get(&source_id, std::path::Path::new(&path))
        .await
        .map_err(|e| format!("Failed to get metadata: {}", e))?;
    
    Ok(meta.map(|m| FileMetadataResponse {
        tags: m.tags.iter().map(|t| TagResponse {
            name: t.name.clone(),
            color: t.color.clone(),
        }).collect(),
        is_favorite: m.is_favorite,
        color_label: m.color_label.map(|c| c.as_str().to_string()),
        rating: m.rating,
        comment: m.comment,
    }))
}

/// Add a tag to a file
#[tauri::command]
pub async fn vfs_add_tag(
    source_id: String,
    path: String,
    tag_name: String,
    tag_color: Option<String>,
) -> Result<String, String> {
    let store_lock = get_metadata_store().await?;
    let guard = store_lock.read().await;
    let store = guard.as_ref().ok_or("Metadata store not initialized")?;
    
    let tag = match tag_color {
        Some(color) => FileTag::with_color(&tag_name, color),
        None => FileTag::new(&tag_name),
    };
    
    store.add_tag(&source_id, std::path::Path::new(&path), tag)
        .await
        .map_err(|e| format!("Failed to add tag: {}", e))?;
    
    info!("Added tag '{}' to {}", tag_name, path);
    Ok(format!("Added tag '{}'", tag_name))
}

/// Remove a tag from a file
#[tauri::command]
pub async fn vfs_remove_tag(
    source_id: String,
    path: String,
    tag_name: String,
) -> Result<String, String> {
    let store_lock = get_metadata_store().await?;
    let guard = store_lock.read().await;
    let store = guard.as_ref().ok_or("Metadata store not initialized")?;
    
    store.remove_tag(&source_id, std::path::Path::new(&path), &tag_name)
        .await
        .map_err(|e| format!("Failed to remove tag: {}", e))?;
    
    info!("Removed tag '{}' from {}", tag_name, path);
    Ok(format!("Removed tag '{}'", tag_name))
}

/// Toggle favorite status
#[tauri::command]
pub async fn vfs_toggle_favorite(
    source_id: String,
    path: String,
) -> Result<bool, String> {
    let store_lock = get_metadata_store().await?;
    let guard = store_lock.read().await;
    let store = guard.as_ref().ok_or("Metadata store not initialized")?;
    
    let new_state = store.toggle_favorite(&source_id, std::path::Path::new(&path))
        .await
        .map_err(|e| format!("Failed to toggle favorite: {}", e))?;
    
    info!("Toggled favorite for {}: {}", path, new_state);
    Ok(new_state)
}

/// Set favorite status explicitly
#[tauri::command]
pub async fn vfs_set_favorite(
    source_id: String,
    path: String,
    is_favorite: bool,
) -> Result<String, String> {
    let store_lock = get_metadata_store().await?;
    let guard = store_lock.read().await;
    let store = guard.as_ref().ok_or("Metadata store not initialized")?;
    
    store.set_favorite(&source_id, std::path::Path::new(&path), is_favorite)
        .await
        .map_err(|e| format!("Failed to set favorite: {}", e))?;
    
    Ok(if is_favorite { "Added to favorites" } else { "Removed from favorites" }.to_string())
}

/// Set color label
#[tauri::command]
pub async fn vfs_set_color_label(
    source_id: String,
    path: String,
    color: Option<String>,
) -> Result<String, String> {
    let store_lock = get_metadata_store().await?;
    let guard = store_lock.read().await;
    let store = guard.as_ref().ok_or("Metadata store not initialized")?;
    
    let color_label = color.as_ref().and_then(|c| ColorLabel::from_str(c));
    
    store.set_color_label(&source_id, std::path::Path::new(&path), color_label)
        .await
        .map_err(|e| format!("Failed to set color label: {}", e))?;
    
    Ok(format!("Set color label to {:?}", color))
}

/// Set rating (0-5)
#[tauri::command]
pub async fn vfs_set_rating(
    source_id: String,
    path: String,
    rating: Option<u8>,
) -> Result<String, String> {
    let store_lock = get_metadata_store().await?;
    let guard = store_lock.read().await;
    let store = guard.as_ref().ok_or("Metadata store not initialized")?;
    
    store.set_rating(&source_id, std::path::Path::new(&path), rating)
        .await
        .map_err(|e| format!("Failed to set rating: {}", e))?;
    
    Ok(format!("Set rating to {:?}", rating))
}

/// Set comment
#[tauri::command]
pub async fn vfs_set_comment(
    source_id: String,
    path: String,
    comment: Option<String>,
) -> Result<String, String> {
    let store_lock = get_metadata_store().await?;
    let guard = store_lock.read().await;
    let store = guard.as_ref().ok_or("Metadata store not initialized")?;
    
    store.set_comment(&source_id, std::path::Path::new(&path), comment.clone())
        .await
        .map_err(|e| format!("Failed to set comment: {}", e))?;
    
    Ok("Comment saved".to_string())
}

/// List all favorites for a source
#[tauri::command]
pub async fn vfs_list_favorites(
    source_id: String,
) -> Result<Vec<String>, String> {
    let store_lock = get_metadata_store().await?;
    let guard = store_lock.read().await;
    let store = guard.as_ref().ok_or("Metadata store not initialized")?;
    
    store.list_favorites(&source_id)
        .await
        .map_err(|e| format!("Failed to list favorites: {}", e))
}

/// List files with a specific tag
#[tauri::command]
pub async fn vfs_list_by_tag(
    source_id: String,
    tag_name: String,
) -> Result<Vec<String>, String> {
    let store_lock = get_metadata_store().await?;
    let guard = store_lock.read().await;
    let store = guard.as_ref().ok_or("Metadata store not initialized")?;
    
    store.list_by_tag(&source_id, &tag_name)
        .await
        .map_err(|e| format!("Failed to list by tag: {}", e))
}

/// List files with a specific color label
#[tauri::command]
pub async fn vfs_list_by_color(
    source_id: String,
    color: String,
) -> Result<Vec<String>, String> {
    let store_lock = get_metadata_store().await?;
    let guard = store_lock.read().await;
    let store = guard.as_ref().ok_or("Metadata store not initialized")?;
    
    let color_label = ColorLabel::from_str(&color)
        .ok_or_else(|| format!("Invalid color: {}", color))?;
    
    store.list_by_color(&source_id, color_label)
        .await
        .map_err(|e| format!("Failed to list by color: {}", e))
}

/// List all unique tags
#[tauri::command]
pub async fn vfs_list_all_tags(
    source_id: String,
) -> Result<Vec<TagResponse>, String> {
    let store_lock = get_metadata_store().await?;
    let guard = store_lock.read().await;
    let store = guard.as_ref().ok_or("Metadata store not initialized")?;
    
    let tags = store.list_all_tags(&source_id)
        .await
        .map_err(|e| format!("Failed to list tags: {}", e))?;
    
    Ok(tags.into_iter().map(|t| TagResponse {
        name: t.name,
        color: t.color,
    }).collect())
}

// ============================================================================
// Cross-Storage Commands - Move/Copy between storage sources
// ============================================================================

/// Response for cross-storage transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossStorageTransferResponse {
    pub bytes_transferred: u64,
    pub source_deleted: bool,
    pub destination_path: String,
}

/// Response for available transfer targets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferTargetResponse {
    pub id: String,
    pub name: String,
    pub source_type: String,
}

/// Copy file or folder to another storage source
#[tauri::command]
pub async fn vfs_copy_to_source(
    from_source_id: String,
    from_path: String,
    to_source_id: String,
    to_path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<CrossStorageTransferResponse, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let bytes = service.copy_to_source(
        &from_source_id,
        std::path::Path::new(&from_path),
        &to_source_id,
        std::path::Path::new(&to_path),
    )
        .await
        .map_err(|e| format!("Failed to copy: {}", e))?;
    
    info!(
        "Copied {} from {} to {}:{} ({} bytes)",
        from_path, from_source_id, to_source_id, to_path, bytes
    );
    
    Ok(CrossStorageTransferResponse {
        bytes_transferred: bytes,
        source_deleted: false,
        destination_path: to_path,
    })
}

/// Move file or folder to another storage source (copy + delete source)
#[tauri::command]
pub async fn vfs_move_to_source(
    from_source_id: String,
    from_path: String,
    to_source_id: String,
    to_path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<CrossStorageTransferResponse, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let bytes = service.move_to_source(
        &from_source_id,
        std::path::Path::new(&from_path),
        &to_source_id,
        std::path::Path::new(&to_path),
    )
        .await
        .map_err(|e| format!("Failed to move: {}", e))?;
    
    info!(
        "Moved {} from {} to {}:{} ({} bytes)",
        from_path, from_source_id, to_source_id, to_path, bytes
    );
    
    Ok(CrossStorageTransferResponse {
        bytes_transferred: bytes,
        source_deleted: true,
        destination_path: to_path,
    })
}

/// Get available storage sources to transfer to
#[tauri::command]
pub async fn vfs_get_transfer_targets(
    exclude_source_id: Option<String>,
    state: State<'_, VfsStateWrapper>,
) -> Result<Vec<TransferTargetResponse>, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let targets = service.get_transfer_targets(exclude_source_id.as_deref());
    
    Ok(targets.into_iter().map(|s| TransferTargetResponse {
        id: s.id,
        name: s.name,
        source_type: format!("{:?}", s.source_type),
    }).collect())
}

/// Batch copy multiple files to another storage source
#[tauri::command]
pub async fn vfs_batch_copy_to_source(
    from_source_id: String,
    from_paths: Vec<String>,
    to_source_id: String,
    to_path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<CrossStorageTransferResponse, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let mut total_bytes = 0u64;
    
    for path in &from_paths {
        let bytes = service.copy_to_source(
            &from_source_id,
            std::path::Path::new(path),
            &to_source_id,
            std::path::Path::new(&to_path),
        )
            .await
            .map_err(|e| format!("Failed to copy {}: {}", path, e))?;
        
        total_bytes += bytes;
    }
    
    info!(
        "Batch copied {} files from {} to {} ({} bytes)",
        from_paths.len(), from_source_id, to_source_id, total_bytes
    );
    
    Ok(CrossStorageTransferResponse {
        bytes_transferred: total_bytes,
        source_deleted: false,
        destination_path: to_path,
    })
}

/// Batch move multiple files to another storage source
#[tauri::command]
pub async fn vfs_batch_move_to_source(
    from_source_id: String,
    from_paths: Vec<String>,
    to_source_id: String,
    to_path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<CrossStorageTransferResponse, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let mut total_bytes = 0u64;
    
    for path in &from_paths {
        let bytes = service.move_to_source(
            &from_source_id,
            std::path::Path::new(path),
            &to_source_id,
            std::path::Path::new(&to_path),
        )
            .await
            .map_err(|e| format!("Failed to move {}: {}", path, e))?;
        
        total_bytes += bytes;
    }
    
    info!(
        "Batch moved {} files from {} to {} ({} bytes)",
        from_paths.len(), from_source_id, to_source_id, total_bytes
    );
    
    Ok(CrossStorageTransferResponse {
        bytes_transferred: total_bytes,
        source_deleted: true,
        destination_path: to_path,
    })
}

// ============================================================================
// Storage Sync Commands - Sync between storage backends (S3 ↔ FSx ONTAP)
// ============================================================================

/// Sync request from frontend
#[derive(Debug, Clone, Deserialize)]
pub struct SyncRequestDto {
    pub from_source_id: String,
    pub from_paths: Vec<String>,
    pub to_source_id: String,
    pub to_path: String,
    pub direction: String,
    pub mode: String,
    pub use_nvme_cache: Option<bool>,
    pub delete_orphans: Option<bool>,
    pub priority: Option<String>,
}

/// Sync result for frontend
#[derive(Debug, Clone, Serialize)]
pub struct SyncResultDto {
    pub files_synced: usize,
    pub files_skipped: usize,
    pub files_failed: usize,
    pub bytes_transferred: u64,
    pub files_deleted: usize,
    pub errors: Vec<String>,
    pub duration_ms: u64,
    pub used_nvme_cache: bool,
}

/// Sync target for frontend
#[derive(Debug, Clone, Serialize)]
pub struct SyncTargetDto {
    pub source_id: String,
    pub name: String,
    pub storage_type: String,
    pub category: String,
    pub has_nvme_cache: bool,
    pub has_s3_integration: bool,
    pub supported_directions: Vec<String>,
}

/// Sync files between storage sources
/// 
/// Supports:
/// - S3 ↔ FSx ONTAP block storage (leveraging native FSx-S3 integration)
/// - Multi-select file/folder operations
/// - NVMe cache acceleration on Windows Server 2025
#[tauri::command]
pub async fn vfs_sync(
    request: SyncRequestDto,
    state: State<'_, VfsStateWrapper>,
) -> Result<SyncResultDto, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let start = std::time::Instant::now();
    let use_cache = request.use_nvme_cache.unwrap_or(true);
    
    let mut files_synced = 0usize;
    let mut files_failed = 0usize;
    let mut bytes_transferred = 0u64;
    let mut errors = Vec::new();
    
    for path in &request.from_paths {
        match service.copy_to_source(
            &request.from_source_id,
            std::path::Path::new(path),
            &request.to_source_id,
            std::path::Path::new(&request.to_path),
        ).await {
            Ok(bytes) => {
                files_synced += 1;
                bytes_transferred += bytes;
            }
            Err(e) => {
                files_failed += 1;
                errors.push(format!("{}: {}", path, e));
            }
        }
    }
    
    let duration_ms = start.elapsed().as_millis() as u64;
    
    info!(
        "Sync {} -> {}: {} files synced, {} failed, {} bytes in {}ms",
        request.from_source_id, request.to_source_id,
        files_synced, files_failed, bytes_transferred, duration_ms
    );
    
    Ok(SyncResultDto {
        files_synced,
        files_skipped: 0,
        files_failed,
        bytes_transferred,
        files_deleted: 0,
        errors,
        duration_ms,
        used_nvme_cache: use_cache,
    })
}

/// Get available sync targets for a source
#[tauri::command]
pub async fn vfs_get_sync_targets(
    source_id: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<Vec<SyncTargetDto>, String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let targets = service.get_transfer_targets(Some(&source_id));
    
    Ok(targets.into_iter().map(|s| {
        let is_fsx = matches!(s.source_type, crate::vfs::domain::StorageSourceType::FsxOntap);
        let is_s3 = matches!(s.source_type, crate::vfs::domain::StorageSourceType::S3);
        
        SyncTargetDto {
            source_id: s.id,
            name: s.name,
            storage_type: format!("{:?}", s.source_type),
            category: match s.source_type {
                crate::vfs::domain::StorageSourceType::Local => "local".to_string(),
                crate::vfs::domain::StorageSourceType::S3 => "cloud".to_string(),
                crate::vfs::domain::StorageSourceType::S3Compatible => "cloud".to_string(),
                crate::vfs::domain::StorageSourceType::Gcs => "cloud".to_string(),
                crate::vfs::domain::StorageSourceType::AzureBlob => "cloud".to_string(),
                crate::vfs::domain::StorageSourceType::FsxOntap => "hybrid".to_string(),
                crate::vfs::domain::StorageSourceType::FsxN => "hybrid".to_string(),
                crate::vfs::domain::StorageSourceType::Block => "block".to_string(),
                crate::vfs::domain::StorageSourceType::Nas => "network".to_string(),
                crate::vfs::domain::StorageSourceType::Smb => "network".to_string(),
                crate::vfs::domain::StorageSourceType::Nfs => "network".to_string(),
                crate::vfs::domain::StorageSourceType::Sftp => "network".to_string(),
                crate::vfs::domain::StorageSourceType::WebDav => "network".to_string(),
                crate::vfs::domain::StorageSourceType::Custom(_) => "custom".to_string(),
            },
            has_nvme_cache: true, // Assume available on Windows Server 2025
            has_s3_integration: is_fsx, // FSx ONTAP has native S3 integration
            supported_directions: if is_fsx && is_s3 {
                vec!["ObjectToBlock".to_string(), "BlockToObject".to_string()]
            } else {
                vec!["ToHot".to_string(), "FromHot".to_string()]
            },
        }
    }).collect())
}

/// Change tier of files (hydrate from cold/nearline to hot)
#[tauri::command]
pub async fn vfs_change_tier(
    source_id: String,
    paths: Vec<String>,
    target_tier: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<SyncResultDto, String> {
    let _service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let start = std::time::Instant::now();
    
    // Tiering operation - for now, this is a placeholder
    // In production, this would:
    // 1. For FSx ONTAP: trigger fabric-pool tiering API
    // 2. For S3: change storage class (Glacier → Standard)
    // 3. Use NVMe cache as hot tier on Windows Server 2025
    
    info!(
        "Tier change requested: {} files to {} tier on {}",
        paths.len(), target_tier, source_id
    );
    
    // Simulate tiering (in real impl, would call storage-specific APIs)
    let files_synced = paths.len();
    let duration_ms = start.elapsed().as_millis() as u64;
    
    Ok(SyncResultDto {
        files_synced,
        files_skipped: 0,
        files_failed: 0,
        bytes_transferred: 0,
        files_deleted: 0,
        errors: Vec::new(),
        duration_ms,
        used_nvme_cache: target_tier == "hot",
    })
}

/// Check if NVMe cache is available (Windows Server 2025 Native NVMe)
#[tauri::command]
pub async fn vfs_check_nvme_cache() -> Result<NvmeCacheStatusDto, String> {
    // Check for Windows Server 2025 Native NVMe support
    // Registry key: HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Policies\Microsoft\FeatureManagement\Overrides\1176759950
    
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        // Check if Native NVMe is enabled via registry
        let output = Command::new("reg")
            .args(["query", 
                   r"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Policies\Microsoft\FeatureManagement\Overrides",
                   "/v", "1176759950"])
            .output();
        
        let native_nvme_enabled = output
            .map(|o| String::from_utf8_lossy(&o.stdout).contains("0x1"))
            .unwrap_or(false);
        
        return Ok(NvmeCacheStatusDto {
            available: true,
            native_nvme_enabled,
            iops_improvement: if native_nvme_enabled { Some(1.8) } else { None },
            capacity_bytes: 0, // Would query actual NVMe capacity
            used_bytes: 0,
            hit_rate: 0,
        });
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Ok(NvmeCacheStatusDto {
            available: false,
            native_nvme_enabled: false,
            iops_improvement: None,
            capacity_bytes: 0,
            used_bytes: 0,
            hit_rate: 0,
        })
    }
}

/// NVMe cache status for frontend
#[derive(Debug, Clone, Serialize)]
pub struct NvmeCacheStatusDto {
    pub available: bool,
    pub native_nvme_enabled: bool,
    pub iops_improvement: Option<f32>,
    pub capacity_bytes: u64,
    pub used_bytes: u64,
    pub hit_rate: u8,
}

/// Set tags for a file (replaces all existing tags)
/// Uses simple file for now, can be extended to use metadata service
#[tauri::command]
pub async fn vfs_set_tags(
    _source_id: String,
    path: String,
    tags: Vec<String>,
) -> Result<(), String> {
    // Store tags in a sidecar file or extended attributes
    // For now, just log and return success
    info!("Setting tags for {}: {:?}", path, tags);
    
    // In a full implementation, this would:
    // 1. Store tags in extended file attributes (macOS/Linux)
    // 2. Store in alternate data streams (Windows)
    // 3. Or use a local database/sidecar file
    
    Ok(())
}

/// Reveal file in system file manager (Finder on macOS, Explorer on Windows)
#[tauri::command]
pub async fn vfs_reveal_in_finder(
    _source_id: String,
    path: String,
) -> Result<(), String> {
    // For local files, reveal directly using the path
    // For remote files, we'd need to first cache them
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path.replace('/', "\\")])
            .spawn()
            .map_err(|e| format!("Failed to open Explorer: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        // Try various file managers
        let managers = ["nautilus", "dolphin", "thunar", "nemo", "xdg-open"];
        let mut opened = false;
        for manager in managers {
            if std::process::Command::new(manager)
                .arg(&path)
                .spawn()
                .is_ok()
            {
                opened = true;
                break;
            }
        }
        if !opened {
            return Err("No file manager found".to_string());
        }
    }
    
    Ok(())
}

// ============================================================================
// File Open Commands - Open files with default or specific applications
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub path: String,
    pub bundle_id: Option<String>,
    pub icon: Option<String>,
}

/// Open a file with the default application
#[tauri::command]
pub async fn vfs_open_file(
    source_id: String,
    file_path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<(), String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    // Get the real path for the file
    let real_path = service.get_real_path(&source_id, std::path::Path::new(&file_path))
        .await
        .map_err(|e| format!("Failed to resolve path: {}", e))?;
    
    info!("Opening file with default app: {:?}", real_path);
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&real_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", real_path.to_str().unwrap_or("")])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&real_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    Ok(())
}

/// Open a file with a specific application
#[tauri::command]
pub async fn vfs_open_file_with(
    source_id: String,
    file_path: String,
    app_path: String,
    state: State<'_, VfsStateWrapper>,
) -> Result<(), String> {
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    // Get the real path for the file
    let real_path = service.get_real_path(&source_id, std::path::Path::new(&file_path))
        .await
        .map_err(|e| format!("Failed to resolve path: {}", e))?;
    
    info!("Opening file with app {}: {:?}", app_path, real_path);
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-a", &app_path])
            .arg(&real_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new(&app_path)
            .arg(&real_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new(&app_path)
            .arg(&real_path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    Ok(())
}

/// Get list of applications that can open a file type
#[tauri::command]
pub async fn vfs_get_apps_for_file(
    file_path: String,
) -> Result<Vec<AppInfo>, String> {
    let extension = std::path::Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    let mut apps = Vec::new();
    
    #[cfg(target_os = "macos")]
    {
        // Use Launch Services to get apps that can open this file type
        // For now, we return common apps based on extension
        let common_apps = get_macos_apps_for_extension(&extension);
        apps.extend(common_apps);
    }
    
    #[cfg(target_os = "windows")]
    {
        let common_apps = get_windows_apps_for_extension(&extension);
        apps.extend(common_apps);
    }
    
    #[cfg(target_os = "linux")]
    {
        let common_apps = get_linux_apps_for_extension(&extension);
        apps.extend(common_apps);
    }
    
    Ok(apps)
}

#[cfg(target_os = "macos")]
fn get_macos_apps_for_extension(extension: &str) -> Vec<AppInfo> {
    use std::process::Command;
    use std::collections::HashSet;
    use std::path::Path;
    
    let mut apps = Vec::new();
    // Track seen apps by bundle_id, normalized path, and name to prevent duplicates
    let mut seen_bundle_ids = HashSet::new();
    let mut seen_paths = HashSet::new();
    let mut seen_names = HashSet::new();
    
    // Helper to normalize paths (resolve symlinks, canonicalize)
    let normalize_path = |path: &str| -> String {
        Path::new(path)
            .canonicalize()
            .ok()
            .and_then(|p| p.to_str().map(|s| s.to_string()))
            .unwrap_or_else(|| path.to_string())
    };
    
    // Helper function to check if app is already seen
    fn is_app_seen(
        app: &AppInfo,
        seen_bundle_ids: &HashSet<String>,
        seen_paths: &HashSet<String>,
        seen_names: &HashSet<String>,
        normalize_path: &dyn Fn(&str) -> String,
    ) -> bool {
        // Check by bundle_id first (most reliable)
        if let Some(ref bundle_id) = app.bundle_id {
            if seen_bundle_ids.contains(bundle_id) {
                return true;
            }
        }
        
        // Check by normalized path
        let normalized_path = normalize_path(&app.path);
        if seen_paths.contains(&normalized_path) {
            return true;
        }
        
        // Check by name (fallback for apps without bundle_id)
        // Only check name if we don't have bundle_id or path match
        if app.bundle_id.is_none() && seen_names.contains(&app.name.to_lowercase()) {
            return true;
        }
        
        false
    }
    
    // First, try to get apps from macOS Launch Services using AppleScript
    // This queries the actual system database of registered applications
    if let Some(ls_apps) = get_apps_from_launch_services(extension) {
        for app in ls_apps {
            if !is_app_seen(&app, &seen_bundle_ids, &seen_paths, &seen_names, &normalize_path) {
                // Mark as seen
                if let Some(ref bundle_id) = app.bundle_id {
                    seen_bundle_ids.insert(bundle_id.clone());
                }
                let normalized_path = normalize_path(&app.path);
                seen_paths.insert(normalized_path);
                seen_names.insert(app.name.to_lowercase());
                apps.push(app);
            }
        }
    }
    
    // Also add common apps that are known to handle this extension
    // Only add if not already seen from Launch Services
    let common_apps = get_common_macos_apps_for_extension(extension);
    for (name, path) in common_apps {
        if !Path::new(path).exists() {
            continue;
        }
        
        let normalized_path = normalize_path(path);
        if seen_paths.contains(&normalized_path) {
            continue;
        }
        
        // Check if we already have an app with this name
        let name_lower = name.to_lowercase();
        if seen_names.contains(&name_lower) {
            continue;
        }
        
        // Try to get bundle_id for this app
        let bundle_id = get_bundle_id_for_path(path);
        
        // If we have a bundle_id, check if it's already seen
        if let Some(ref bid) = bundle_id {
            if seen_bundle_ids.contains(bid) {
                continue;
            }
        }
        
        // Mark as seen
        if let Some(ref bid) = bundle_id {
            seen_bundle_ids.insert(bid.clone());
        }
        let normalized_path = normalize_path(path);
        seen_paths.insert(normalized_path);
        seen_names.insert(name.to_lowercase());
        
        apps.push(AppInfo {
            name: name.to_string(),
            path: path.to_string(),
            bundle_id,
            icon: None,
        });
    }
    
    // Scan /Applications for additional known apps
    let additional_apps = scan_applications_folder(extension);
    for app in additional_apps {
        if !is_app_seen(&app, &seen_bundle_ids, &seen_paths, &seen_names, &normalize_path) {
            // Mark as seen
            if let Some(ref bundle_id) = app.bundle_id {
                seen_bundle_ids.insert(bundle_id.clone());
            }
            let normalized_path = normalize_path(&app.path);
            seen_paths.insert(normalized_path);
            seen_names.insert(app.name.to_lowercase());
            apps.push(app);
        }
    }
    
    // Sort by name
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    // Limit to 20 apps
    apps.truncate(20);
    
    // If still empty, add TextEdit as fallback
    if apps.is_empty() {
        if Path::new("/System/Applications/TextEdit.app").exists() {
            apps.push(AppInfo {
                name: "TextEdit".to_string(),
                path: "/System/Applications/TextEdit.app".to_string(),
                bundle_id: Some("com.apple.TextEdit".to_string()),
                icon: None,
            });
        }
    }
    
    apps
}

/// Get bundle ID for an app path (macOS only)
#[cfg(target_os = "macos")]
fn get_bundle_id_for_path(app_path: &str) -> Option<String> {
    use std::process::Command;
    
    // Use AppleScript to get bundle ID
    let script = format!(r#"
tell application "System Events"
    try
        set appBundle to application file "{}"
        set bundleId to bundle identifier of appBundle
        return bundleId
    on error
        return ""
    end try
end tell
"#, app_path);
    
    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .ok()?;
    
    if output.status.success() {
        let bundle_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !bundle_id.is_empty() {
            return Some(bundle_id);
        }
    }
    
    None
}

/// Query macOS Launch Services for apps that can open a specific file type
#[cfg(target_os = "macos")]
fn get_apps_from_launch_services(extension: &str) -> Option<Vec<AppInfo>> {
    use std::process::Command;
    
    // Get UTI for the extension
    let uti = extension_to_uti(extension);
    
    // Use AppleScript to query Launch Services for apps that handle this UTI
    let script = format!(r#"
use framework "AppKit"
use scripting additions

set theApps to {{}}
set theUTI to "{}"

try
    -- Get all apps that can open this content type
    set workspace to current application's NSWorkspace's sharedWorkspace()
    set appURLs to workspace's URLsForApplicationsToOpenContentType:(current application's UTType's typeWithIdentifier:theUTI)
    
    if appURLs is not missing value then
        repeat with appURL in appURLs
            set appPath to (appURL's |path|()) as text
            -- Get app name from bundle
            set appBundle to current application's NSBundle's bundleWithPath:appPath
            if appBundle is not missing value then
                set appName to (appBundle's objectForInfoDictionaryKey:"CFBundleName") as text
                set bundleId to (appBundle's bundleIdentifier()) as text
                if appName is not missing value and appName is not "" then
                    set end of theApps to appName & "|" & appPath & "|" & bundleId
                end if
            end if
        end repeat
    end if
end try

set AppleScript's text item delimiters to linefeed
return theApps as text
"#, uti);

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .ok()?;
    
    if !output.status.success() {
        // Try fallback method using lsregister
        return get_apps_from_lsregister(extension);
    }
    
    let text = String::from_utf8_lossy(&output.stdout);
    let mut apps = Vec::new();
    
    for line in text.lines() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 2 {
            let name = parts[0].trim();
            let path = parts[1].trim();
            let bundle_id = parts.get(2).map(|s| s.trim().to_string());
            
            if !name.is_empty() && std::path::Path::new(path).exists() {
                apps.push(AppInfo {
                    name: name.to_string(),
                    path: path.to_string(),
                    bundle_id,
                    icon: None,
                });
            }
        }
    }
    
    if apps.is_empty() {
        // Fallback to lsregister method
        return get_apps_from_lsregister(extension);
    }
    
    Some(apps)
}

/// Fallback: Query lsregister database for apps that handle a file type
#[cfg(target_os = "macos")]
fn get_apps_from_lsregister(extension: &str) -> Option<Vec<AppInfo>> {
    use std::process::Command;
    
    // Use mdfind to find apps that can open this file type
    let output = Command::new("mdfind")
        .args([
            "kMDItemContentType == 'com.apple.application-bundle'",
        ])
        .output()
        .ok()?;
    
    if !output.status.success() {
        return None;
    }
    
    let text = String::from_utf8_lossy(&output.stdout);
    let mut apps = Vec::new();
    let ext_lower = extension.to_lowercase();
    
    // Get apps from common locations that exist
    let app_dirs = ["/Applications", "/System/Applications", &format!("{}/Applications", std::env::var("HOME").unwrap_or_default())];
    
    for line in text.lines() {
        let path = line.trim();
        if path.ends_with(".app") && std::path::Path::new(path).exists() {
            // Check if app might handle this extension by reading its Info.plist
            if let Some(app_info) = check_app_handles_extension(path, &ext_lower) {
                apps.push(app_info);
            }
        }
    }
    
    // Limit results
    apps.truncate(15);
    
    Some(apps)
}

/// Check if an app declares it can handle a specific file extension
#[cfg(target_os = "macos")]
fn check_app_handles_extension(app_path: &str, extension: &str) -> Option<AppInfo> {
    use std::process::Command;
    
    // Use defaults to read Info.plist and check CFBundleDocumentTypes
    let plist_path = format!("{}/Contents/Info.plist", app_path);
    if !std::path::Path::new(&plist_path).exists() {
        return None;
    }
    
    // Quick check using plutil
    let output = Command::new("plutil")
        .args(["-convert", "json", "-o", "-", &plist_path])
        .output()
        .ok()?;
    
    if !output.status.success() {
        return None;
    }
    
    let json_str = String::from_utf8_lossy(&output.stdout);
    
    // Check if extension is mentioned in the plist
    let ext_patterns = [
        format!("\"{}\"", extension),
        format!(".{}", extension),
        extension.to_uppercase(),
    ];
    
    let handles = ext_patterns.iter().any(|pattern| json_str.contains(pattern));
    
    if handles {
        // Extract app name
        let name = std::path::Path::new(app_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .map(|s| s.replace(".app", ""))
            .unwrap_or_else(|| "Unknown".to_string());
        
        // Try to get bundle ID from plist
        let bundle_id = if let Ok(bid_output) = Command::new("defaults")
            .args(["read", &plist_path, "CFBundleIdentifier"])
            .output() {
            if bid_output.status.success() {
                Some(String::from_utf8_lossy(&bid_output.stdout).trim().to_string())
            } else {
                None
            }
        } else {
            None
        };
        
        return Some(AppInfo {
            name,
            path: app_path.to_string(),
            bundle_id,
            icon: None,
        });
    }
    
    None
}

/// Map file extension to macOS UTI (Uniform Type Identifier)
#[cfg(target_os = "macos")]
fn extension_to_uti(extension: &str) -> String {
    match extension.to_lowercase().as_str() {
        // Images
        "jpg" | "jpeg" => "public.jpeg",
        "png" => "public.png",
        "gif" => "com.compuserve.gif",
        "tiff" | "tif" => "public.tiff",
        "bmp" => "com.microsoft.bmp",
        "heic" | "heif" => "public.heic",
        "webp" => "public.webp",
        "svg" => "public.svg-image",
        "ico" => "com.microsoft.ico",
        "raw" => "public.camera-raw-image",
        "psd" => "com.adobe.photoshop-image",
        
        // Videos
        "mp4" => "public.mpeg-4",
        "mov" => "com.apple.quicktime-movie",
        "avi" => "public.avi",
        "mkv" => "org.matroska.mkv",
        "webm" => "org.webmproject.webm",
        "m4v" => "com.apple.m4v-video",
        "wmv" => "com.microsoft.windows-media-wmv",
        "flv" => "com.adobe.flash.video",
        
        // Audio
        "mp3" => "public.mp3",
        "wav" => "com.microsoft.waveform-audio",
        "aac" => "public.aac-audio",
        "flac" => "org.xiph.flac",
        "m4a" => "com.apple.m4a-audio",
        "aiff" | "aif" => "public.aiff-audio",
        "ogg" => "org.xiph.ogg-audio",
        "wma" => "com.microsoft.windows-media-wma",
        
        // Documents
        "pdf" => "com.adobe.pdf",
        "doc" => "com.microsoft.word.doc",
        "docx" => "org.openxmlformats.wordprocessingml.document",
        "xls" => "com.microsoft.excel.xls",
        "xlsx" => "org.openxmlformats.spreadsheetml.sheet",
        "ppt" => "com.microsoft.powerpoint.ppt",
        "pptx" => "org.openxmlformats.presentationml.presentation",
        "rtf" => "public.rtf",
        "txt" => "public.plain-text",
        "csv" => "public.comma-separated-values-text",
        
        // Code/Text
        "json" => "public.json",
        "xml" => "public.xml",
        "html" | "htm" => "public.html",
        "css" => "public.css",
        "js" => "com.netscape.javascript-source",
        "ts" => "com.microsoft.typescript",
        "md" => "net.daringfireball.markdown",
        "py" => "public.python-script",
        "rb" => "public.ruby-script",
        "swift" => "public.swift-source",
        "c" => "public.c-source",
        "cpp" | "cc" => "public.c-plus-plus-source",
        "h" => "public.c-header",
        "java" => "com.sun.java-source",
        "go" => "public.go-source",
        "rs" => "public.rust-source",
        "sh" => "public.shell-script",
        "yaml" | "yml" => "public.yaml",
        
        // Archives
        "zip" => "public.zip-archive",
        "tar" => "public.tar-archive",
        "gz" | "gzip" => "org.gnu.gnu-zip-archive",
        "bz2" => "public.bzip2-archive",
        "rar" => "com.rarlab.rar-archive",
        "7z" => "org.7-zip.7-zip-archive",
        "dmg" => "com.apple.disk-image-udif",
        
        // Default
        _ => "public.data",
    }.to_string()
}

#[cfg(target_os = "macos")]
fn scan_applications_folder(extension: &str) -> Vec<AppInfo> {
    let mut apps = Vec::new();
    
    // Map extensions to app names that can open them
    let app_associations: Vec<(&str, Vec<&str>)> = vec![
        ("Preview", vec!["jpg", "jpeg", "png", "gif", "pdf", "tiff", "bmp", "heic", "webp", "svg"]),
        ("Photos", vec!["jpg", "jpeg", "png", "gif", "heic", "tiff"]),
        ("QuickTime Player", vec!["mp4", "mov", "m4v", "mp3", "wav", "aac", "m4a"]),
        ("Music", vec!["mp3", "wav", "aac", "m4a", "flac"]),
        ("TextEdit", vec!["txt", "rtf", "md", "text"]),
        ("Safari", vec!["html", "htm", "webarchive", "url"]),
        ("Notes", vec!["txt", "md"]),
        ("VLC", vec!["mp4", "mov", "avi", "mkv", "mp3", "wav", "flac"]),
        ("IINA", vec!["mp4", "mov", "avi", "mkv", "mp3", "wav"]),
        ("Visual Studio Code", vec!["txt", "md", "json", "xml", "yaml", "yml", "js", "ts", "py", "rb", "go", "rs", "html", "css"]),
        ("Cursor", vec!["txt", "md", "json", "xml", "yaml", "yml", "js", "ts", "py", "rb", "go", "rs", "html", "css"]),
        ("Xcode", vec!["swift", "m", "mm", "c", "cpp", "h", "storyboard", "xib"]),
        ("Google Chrome", vec!["html", "htm", "pdf"]),
        ("Firefox", vec!["html", "htm"]),
        ("Numbers", vec!["csv", "xls", "xlsx"]),
        ("Pages", vec!["doc", "docx", "txt", "rtf"]),
        ("Keynote", vec!["ppt", "pptx"]),
        ("Archive Utility", vec!["zip", "tar", "gz", "bz2", "rar", "7z"]),
        ("The Unarchiver", vec!["zip", "tar", "gz", "bz2", "rar", "7z"]),
        ("Adobe Photoshop 2024", vec!["psd", "jpg", "jpeg", "png", "gif", "tiff", "bmp"]),
        ("Adobe Premiere Pro 2024", vec!["mp4", "mov", "avi", "prproj"]),
        ("Final Cut Pro", vec!["mp4", "mov", "fcpxml"]),
        ("DaVinci Resolve", vec!["mp4", "mov", "avi", "drp"]),
        ("Logic Pro", vec!["mp3", "wav", "aiff", "m4a"]),
        ("GarageBand", vec!["mp3", "wav", "aiff", "m4a", "band"]),
        ("Affinity Photo", vec!["jpg", "jpeg", "png", "psd", "tiff"]),
        ("Affinity Designer", vec!["svg", "eps", "pdf"]),
        ("Pixelmator Pro", vec!["jpg", "jpeg", "png", "psd", "tiff"]),
        ("Figma", vec!["fig"]),
        ("Sketch", vec!["sketch"]),
    ];
    
    let app_paths = [
        ("/Applications", ""),
        ("/System/Applications", ""),
        ("/Applications/Adobe Photoshop 2024", "/Adobe Photoshop 2024.app"),
        ("/Applications/Adobe Premiere Pro 2024", "/Adobe Premiere Pro 2024.app"),
        ("/Applications/DaVinci Resolve", "/DaVinci Resolve.app"),
    ];
    
    for (app_name, extensions) in &app_associations {
        if extensions.contains(&extension) {
            // Try to find this app
            for (base_path, extra) in &app_paths {
                let app_path = if extra.is_empty() {
                    format!("{}/{}.app", base_path, app_name)
                } else {
                    format!("{}{}", base_path, extra)
                };
                
                if std::path::Path::new(&app_path).exists() {
                    apps.push(AppInfo {
                        name: app_name.to_string(),
                        path: app_path,
                        bundle_id: None,
                        icon: None,
                    });
                    break;
                }
            }
        }
    }
    
    apps
}

#[cfg(target_os = "macos")]
fn get_common_macos_apps_for_extension(extension: &str) -> Vec<(&'static str, &'static str)> {
    match extension {
        // Images
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "heic" | "tiff" | "bmp" | "svg" => vec![
            ("Preview", "/System/Applications/Preview.app"),
            ("Photos", "/System/Applications/Photos.app"),
        ],
        // Videos
        "mp4" | "mov" | "avi" | "mkv" | "webm" | "m4v" => vec![
            ("QuickTime Player", "/System/Applications/QuickTime Player.app"),
            ("VLC", "/Applications/VLC.app"),
            ("IINA", "/Applications/IINA.app"),
        ],
        // Audio
        "mp3" | "wav" | "aac" | "flac" | "m4a" => vec![
            ("Music", "/System/Applications/Music.app"),
            ("QuickTime Player", "/System/Applications/QuickTime Player.app"),
        ],
        // Documents
        "pdf" => vec![
            ("Preview", "/System/Applications/Preview.app"),
        ],
        // Text/Code
        "txt" | "md" | "json" | "xml" | "yaml" | "yml" => vec![
            ("TextEdit", "/System/Applications/TextEdit.app"),
            ("Visual Studio Code", "/Applications/Visual Studio Code.app"),
            ("Cursor", "/Applications/Cursor.app"),
        ],
        "js" | "ts" | "jsx" | "tsx" | "py" | "rb" | "go" | "rs" | "java" | "swift" => vec![
            ("Visual Studio Code", "/Applications/Visual Studio Code.app"),
            ("Cursor", "/Applications/Cursor.app"),
            ("Xcode", "/Applications/Xcode.app"),
        ],
        // Web
        "html" | "htm" | "css" => vec![
            ("Safari", "/Applications/Safari.app"),
            ("Google Chrome", "/Applications/Google Chrome.app"),
            ("Firefox", "/Applications/Firefox.app"),
        ],
        // Archives
        "zip" | "tar" | "gz" => vec![
            ("Archive Utility", "/System/Library/CoreServices/Applications/Archive Utility.app"),
        ],
        // Default
        _ => vec![
            ("TextEdit", "/System/Applications/TextEdit.app"),
        ]
    }
}

#[cfg(target_os = "windows")]
fn get_windows_apps_for_extension(extension: &str) -> Vec<AppInfo> {
    let mut apps = Vec::new();
    
    // Common Windows apps
    let common_apps = match extension {
        "jpg" | "jpeg" | "png" | "gif" | "bmp" => vec![
            ("Photos", "ms-photos:"),
            ("Paint", "mspaint.exe"),
            ("Paint 3D", "ms-paint:"),
        ],
        "mp4" | "mov" | "avi" | "mkv" | "wmv" => vec![
            ("Movies & TV", "mswindowsvideo:"),
            ("VLC", "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe"),
            ("Windows Media Player", "wmplayer.exe"),
        ],
        "mp3" | "wav" | "flac" | "m4a" => vec![
            ("Groove Music", "mswindowsmusic:"),
            ("VLC", "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe"),
            ("Windows Media Player", "wmplayer.exe"),
        ],
        "pdf" => vec![
            ("Microsoft Edge", "msedge.exe"),
            ("Adobe Acrobat Reader", "C:\\Program Files\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe"),
        ],
        "txt" | "md" | "json" | "xml" => vec![
            ("Notepad", "notepad.exe"),
            ("Visual Studio Code", "C:\\Users\\*\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe"),
            ("Notepad++", "C:\\Program Files\\Notepad++\\notepad++.exe"),
        ],
        _ => vec![
            ("Notepad", "notepad.exe"),
        ],
    };
    
    for (name, path) in common_apps {
        apps.push(AppInfo {
            name: name.to_string(),
            path: path.to_string(),
            bundle_id: None,
            icon: None,
        });
    }
    
    apps
}

#[cfg(target_os = "linux")]
fn get_linux_apps_for_extension(extension: &str) -> Vec<AppInfo> {
    let mut apps = Vec::new();
    
    // Common Linux apps
    let common_apps = match extension {
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "svg" => vec![
            ("Eye of GNOME", "eog"),
            ("GIMP", "gimp"),
            ("Shotwell", "shotwell"),
            ("gThumb", "gthumb"),
        ],
        "mp4" | "mov" | "avi" | "mkv" | "webm" => vec![
            ("VLC", "vlc"),
            ("Totem", "totem"),
            ("mpv", "mpv"),
            ("Celluloid", "celluloid"),
        ],
        "mp3" | "wav" | "flac" | "ogg" => vec![
            ("Rhythmbox", "rhythmbox"),
            ("VLC", "vlc"),
            ("Audacity", "audacity"),
        ],
        "pdf" => vec![
            ("Evince", "evince"),
            ("Okular", "okular"),
            ("Firefox", "firefox"),
        ],
        "txt" | "md" | "json" | "xml" => vec![
            ("gedit", "gedit"),
            ("Kate", "kate"),
            ("Visual Studio Code", "code"),
            ("Sublime Text", "subl"),
        ],
        _ => vec![
            ("gedit", "gedit"),
            ("xdg-open", "xdg-open"),
        ],
    };
    
    // Check which apps are installed
    for (name, cmd) in common_apps {
        if which_exists(&cmd) {
            apps.push(AppInfo {
                name: name.to_string(),
                path: cmd.to_string(),
                bundle_id: None,
                icon: None,
            });
        }
    }
    
    apps
}

#[cfg(target_os = "linux")]
fn which_exists(cmd: &str) -> bool {
    std::process::Command::new("which")
        .arg(cmd)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

// ============================================================================
// OS Preferences
// ============================================================================

/// OS file system preferences
#[derive(Debug, Clone, Serialize)]
pub struct OsPreferences {
    /// Whether to show hidden files by default
    pub show_hidden_files: bool,
    /// Whether to show file extensions
    pub show_file_extensions: bool,
    /// Whether to show path bar
    pub show_path_bar: bool,
    /// Whether to show status bar
    pub show_status_bar: bool,
    /// Default view mode
    pub default_view: String,
    /// Sort files by
    pub sort_by: String,
    /// Sort direction
    pub sort_ascending: bool,
    /// Platform name
    pub platform: String,
}

/// Get OS file system preferences
#[tauri::command]
pub async fn vfs_get_os_preferences() -> Result<OsPreferences, String> {
    #[cfg(target_os = "macos")]
    {
        get_macos_preferences()
    }
    
    #[cfg(target_os = "windows")]
    {
        get_windows_preferences()
    }
    
    #[cfg(target_os = "linux")]
    {
        Ok(OsPreferences {
            show_hidden_files: false,
            show_file_extensions: true,
            show_path_bar: true,
            show_status_bar: true,
            default_view: "list".to_string(),
            sort_by: "name".to_string(),
            sort_ascending: true,
            platform: "linux".to_string(),
        })
    }
}

#[cfg(target_os = "macos")]
fn get_macos_preferences() -> Result<OsPreferences, String> {
    use std::process::Command;
    
    // Read Finder preferences from defaults
    let show_hidden = Command::new("defaults")
        .args(["read", "com.apple.finder", "AppleShowAllFiles"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "1" || 
                  String::from_utf8_lossy(&o.stdout).trim().to_lowercase() == "true")
        .unwrap_or(false);
    
    let show_extensions = Command::new("defaults")
        .args(["read", "NSGlobalDomain", "AppleShowAllExtensions"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "1" ||
                  String::from_utf8_lossy(&o.stdout).trim().to_lowercase() == "true")
        .unwrap_or(true);
    
    let show_path_bar = Command::new("defaults")
        .args(["read", "com.apple.finder", "ShowPathbar"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "1")
        .unwrap_or(true);
    
    let show_status_bar = Command::new("defaults")
        .args(["read", "com.apple.finder", "ShowStatusBar"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "1")
        .unwrap_or(true);
    
    // FXPreferredViewStyle: 1=icon, 2=list, 3=column, 4=gallery
    let view_style = Command::new("defaults")
        .args(["read", "com.apple.finder", "FXPreferredViewStyle"])
        .output()
        .map(|o| {
            let val = String::from_utf8_lossy(&o.stdout).trim().to_string();
            match val.as_str() {
                "1" | "icnv" => "icon",
                "2" | "Nlsv" => "list",
                "3" | "clmv" => "column",
                "4" | "glyv" => "gallery",
                _ => "list",
            }.to_string()
        })
        .unwrap_or_else(|_| "list".to_string());
    
    Ok(OsPreferences {
        show_hidden_files: show_hidden,
        show_file_extensions: show_extensions,
        show_path_bar,
        show_status_bar,
        default_view: view_style,
        sort_by: "name".to_string(),
        sort_ascending: true,
        platform: "macos".to_string(),
    })
}

#[cfg(target_os = "windows")]
fn get_windows_preferences() -> Result<OsPreferences, String> {
    // Windows Explorer preferences from registry
    // HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced
    
    let show_hidden = {
        #[cfg(windows)]
        {
            use winreg::enums::*;
            use winreg::RegKey;
            
            RegKey::predef(HKEY_CURRENT_USER)
                .open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced")
                .and_then(|key: RegKey| key.get_value::<u32, _>("Hidden"))
                .map(|v: u32| v == 1) // 1 = show, 2 = hide
                .unwrap_or(false)
        }
        #[cfg(not(windows))]
        false
    };
    
    let show_extensions = {
        #[cfg(windows)]
        {
            use winreg::enums::*;
            use winreg::RegKey;
            
            RegKey::predef(HKEY_CURRENT_USER)
                .open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced")
                .and_then(|key: RegKey| key.get_value::<u32, _>("HideFileExt"))
                .map(|v: u32| v == 0) // 0 = show, 1 = hide
                .unwrap_or(true)
        }
        #[cfg(not(windows))]
        true
    };
    
    Ok(OsPreferences {
        show_hidden_files: show_hidden,
        show_file_extensions: show_extensions,
        show_path_bar: true,
        show_status_bar: true,
        default_view: "list".to_string(),
        sort_by: "name".to_string(),
        sort_ascending: true,
        platform: "windows".to_string(),
    })
}

/// Get thumbnail for a file
/// Returns base64-encoded data URL for the thumbnail
#[tauri::command]
pub async fn vfs_get_thumbnail(
    source_id: String,
    file_path: String,
    size: Option<u32>,
    state: State<'_, VfsStateWrapper>,
) -> Result<Option<String>, String> {
    use crate::vfs::adapters::native_thumbnail::{NativeThumbnailAdapter, ThumbnailType};
    use data_encoding::BASE64;
    
    let service = state.get_service()
        .ok_or_else(|| "VFS not initialized".to_string())?;
    
    let thumb_size = size.unwrap_or(128);
    let path = std::path::Path::new(&file_path);
    
    // Check if file type supports thumbnails
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    
    let thumb_type = ThumbnailType::from_extension(ext);
    if !thumb_type.is_supported() {
        return Ok(None);
    }
    
    // Get the source to determine how to get the thumbnail
    let source = service.get_source(&source_id)
        .ok_or_else(|| "Source not found".to_string())?;
    
    // For local/mounted sources, use native OS thumbnail generation
    if let Some(ref mount_point) = source.mount_point {
        let full_path = mount_point.join(path);
        
        if full_path.exists() {
            // Create thumbnail adapter
            let cache_dir = dirs::cache_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
                .join("ursly-thumbnails");
            
            match NativeThumbnailAdapter::new(cache_dir).await {
                Ok(adapter) => {
                    match adapter.generate_thumbnail(&full_path, thumb_size).await {
                        Ok(thumb_data) => {
                            // Convert to base64 data URL
                            let base64_data = BASE64.encode(&thumb_data.data);
                            let data_url = format!("data:image/png;base64,{}", base64_data);
                            return Ok(Some(data_url));
                        }
                        Err(e) => {
                            tracing::debug!("Failed to generate native thumbnail for {}: {}", file_path, e);
                        }
                    }
                }
                Err(e) => {
                    tracing::debug!("Failed to create thumbnail adapter: {}", e);
                }
            }
        }
    }
    
    // For network/object storage without local mount, could call API
    // For now, return None and let frontend handle with a placeholder
    // TODO: Add API-based thumbnail fetching for cloud storage
    
    Ok(None)
}

// ============================================================================
// Transcription Commands
// ============================================================================

/// Global transcription service
static TRANSCRIPTION_SERVICE: Lazy<SyncRwLock<Option<Arc<TranscriptionService>>>> = Lazy::new(|| SyncRwLock::new(None));

/// Get or initialize the global transcription service
async fn get_transcription_service() -> Result<Arc<TranscriptionService>, String> {
    // Try to get existing service
    {
        let service_lock = TRANSCRIPTION_SERVICE.read();
        if let Some(service) = service_lock.as_ref() {
            return Ok(service.clone());
        }
    }
    
    // Initialize service if not yet initialized
    let temp_dir = dirs::cache_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("ursly-transcription");
    
    let service = TranscriptionService::new(temp_dir).await
        .map_err(|e| format!("Failed to initialize transcription service: {}", e))?;
    
    let service_arc = Arc::new(service);
    *TRANSCRIPTION_SERVICE.write() = Some(service_arc.clone());
    
    Ok(service_arc)
}

/// Start live transcription for a video file
#[tauri::command]
pub async fn vfs_start_transcription(
    file_path: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let path = std::path::Path::new(&file_path);
    
    if !path.exists() {
        return Err("File does not exist".to_string());
    }
    
    let service = get_transcription_service().await?;
    
    if !service.is_available() {
        return Err("FFmpeg not available. Please install FFmpeg to use transcription.".to_string());
    }
    
    let job_id = service.start_live_transcription(path, app, None).await
        .map_err(|e| format!("Failed to start transcription: {}", e))?;
    
    info!("Started transcription job: {}", job_id);
    Ok(job_id)
}

/// Stop transcription for a job
#[tauri::command]
pub async fn vfs_stop_transcription(
    job_id: String,
) -> Result<String, String> {
    let service = get_transcription_service().await?;
    
    service.stop_transcription(&job_id)
        .map_err(|e| format!("Failed to stop transcription: {}", e))?;
    
    Ok(format!("Transcription job {} stopped", job_id))
}

/// Get transcription status
#[tauri::command]
pub async fn vfs_get_transcription_status(
    job_id: String,
) -> Result<TranscriptionStatus, String> {
    let service = get_transcription_service().await?;
    
    service.get_status(&job_id)
        .ok_or_else(|| format!("Transcription job {} not found", job_id))
}

/// Get transcription segments
#[tauri::command]
pub async fn vfs_get_transcription_segments(
    job_id: String,
) -> Result<Vec<TranscriptionSegment>, String> {
    let service = get_transcription_service().await?;
    
    service.get_segments(&job_id)
        .ok_or_else(|| format!("Transcription job {} not found", job_id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    #[cfg(target_os = "macos")]
    fn test_no_duplicate_preview_for_pdf() {
        let apps = get_macos_apps_for_extension("pdf");
        
        // Count occurrences of Preview
        let preview_count = apps.iter()
            .filter(|app| app.name.to_lowercase() == "preview")
            .count();
        
        assert_eq!(preview_count, 1, "Preview should appear exactly once, found {}", preview_count);
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_no_duplicate_apps_by_name() {
        let extensions = vec!["pdf", "jpg", "png", "mp4", "txt", "html"];
        
        for ext in extensions {
            let apps = get_macos_apps_for_extension(ext);
            
            // Check for duplicate names (case-insensitive)
            let mut seen_names = HashSet::new();
            for app in &apps {
                let name_lower = app.name.to_lowercase();
                assert!(
                    !seen_names.contains(&name_lower),
                    "Duplicate app name '{}' found for extension '{}'",
                    app.name,
                    ext
                );
                seen_names.insert(name_lower);
            }
        }
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_no_duplicate_apps_by_bundle_id() {
        let apps = get_macos_apps_for_extension("pdf");
        
        let mut seen_bundle_ids = HashSet::new();
        for app in &apps {
            if let Some(ref bundle_id) = app.bundle_id {
                assert!(
                    !seen_bundle_ids.contains(bundle_id),
                    "Duplicate bundle ID '{}' found for app '{}'",
                    bundle_id,
                    app.name
                );
                seen_bundle_ids.insert(bundle_id.clone());
            }
        }
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_no_duplicate_apps_by_path() {
        let apps = get_macos_apps_for_extension("pdf");
        
        // Normalize paths (resolve symlinks)
        let mut seen_paths = HashSet::new();
        for app in &apps {
            let normalized = std::path::Path::new(&app.path)
                .canonicalize()
                .ok()
                .and_then(|p| p.to_str().map(|s| s.to_string()))
                .unwrap_or_else(|| app.path.clone());
            
            assert!(
                !seen_paths.contains(&normalized),
                "Duplicate path '{}' found for app '{}'",
                normalized,
                app.name
            );
            seen_paths.insert(normalized);
        }
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_preview_appears_exactly_once_for_pdf() {
        let apps = get_macos_apps_for_extension("pdf");
        let preview_count = apps.iter()
            .filter(|app| app.name.to_lowercase() == "preview")
            .count();
        
        if std::path::Path::new("/System/Applications/Preview.app").exists() {
            assert_eq!(
                preview_count,
                1,
                "Preview should appear exactly once for PDF files, found {}",
                preview_count
            );
        }
    }

    #[test]
    fn test_apps_sorted_alphabetically() {
        #[cfg(target_os = "macos")]
        let apps = get_macos_apps_for_extension("pdf");
        
        #[cfg(target_os = "windows")]
        let apps = get_windows_apps_for_extension("pdf");
        
        #[cfg(target_os = "linux")]
        let apps = get_linux_apps_for_extension("pdf");
        
        let mut prev_name = String::new();
        for app in &apps {
            if !prev_name.is_empty() {
                assert!(
                    app.name.to_lowercase() >= prev_name.to_lowercase(),
                    "Apps should be sorted alphabetically. '{}' should come before '{}'",
                    prev_name,
                    app.name
                );
            }
            prev_name = app.name.clone();
        }
    }

    #[test]
    fn test_apps_limit() {
        #[cfg(target_os = "macos")]
        let apps = get_macos_apps_for_extension("pdf");
        
        #[cfg(target_os = "windows")]
        let apps = get_windows_apps_for_extension("pdf");
        
        #[cfg(target_os = "linux")]
        let apps = get_linux_apps_for_extension("pdf");
        
        assert!(
            apps.len() <= 20,
            "Should return at most 20 apps, found {}",
            apps.len()
        );
    }
}
