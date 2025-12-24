//! Ursly Desktop - GPU Metrics Monitor & Virtual Filesystem
//!
//! Clean Architecture implementation following Ports & Adapters pattern.
//!
//! ## Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────────┐
//! │                    URSLY DESKTOP APP                            │
//! ├─────────────────────────────────────────────────────────────────┤
//! │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
//! │  │     GPU      │  │    System    │  │     VFS      │          │
//! │  │   Metrics    │  │   Metrics    │  │  (Storage)   │          │
//! │  └──────────────┘  └──────────────┘  └──────────────┘          │
//! │                           │                  │                  │
//! │                    ┌──────┴──────────────────┴──────┐           │
//! │                    │         Tauri Commands         │           │
//! │                    └────────────────────────────────┘           │
//! └─────────────────────────────────────────────────────────────────┘
//! ```

pub mod gpu;
pub mod system;
pub mod commands;
pub mod vfs;

use serde::{Serialize, Deserialize};
use chrono::Utc;
use tauri::Manager;

use vfs::commands::VfsStateWrapper;

// ============================================================================
// Developer Tools Toggle
// ============================================================================

#[tauri::command]
fn toggle_devtools(window: tauri::Window) {
    // In Tauri 2.x, devtools are accessed through WebviewWindow
    #[cfg(debug_assertions)]
    if let Some(webview_window) = window.get_webview_window("main") {
        // Use webview_window methods if available
        let _ = webview_window.eval("console.log('DevTools toggled')");
    }
}

#[tauri::command]
fn open_devtools(_window: tauri::Window) {
    // DevTools are automatically available in debug builds via right-click
    #[cfg(debug_assertions)]
    tracing::info!("DevTools can be opened via right-click -> Inspect Element");
}

#[tauri::command]
fn close_devtools(_window: tauri::Window) {
    // DevTools are managed by the browser context in Tauri 2.x
    #[cfg(debug_assertions)]
    tracing::info!("DevTools closed");
}

// ============================================================================
// Storage Types for Finder UI
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageSource {
    pub id: String,
    pub name: String,
    pub r#type: String,
    pub path: Option<String>,
    pub bucket: Option<String>,
    pub region: Option<String>,
    pub connected: bool,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size: u64,
    #[serde(rename = "sizeHuman")]
    pub size_human: String,
    #[serde(rename = "lastModified")]
    pub last_modified: String,
    #[serde(rename = "isDirectory")]
    pub is_directory: bool,
    #[serde(rename = "tierStatus")]
    pub tier_status: String,
    #[serde(rename = "canWarm")]
    pub can_warm: bool,
    #[serde(rename = "isCached")]
    pub is_cached: bool,
    #[serde(rename = "canTranscode")]
    pub can_transcode: bool,
    #[serde(rename = "transcodeStatus")]
    pub transcode_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MountRequest {
    pub r#type: String,
    pub name: String,
    pub path: Option<String>,
    pub bucket: Option<String>,
    pub region: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarmRequest {
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub priority: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscodeRequest {
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub format: String,
    pub quality: Option<String>,
}

// ============================================================================
// Storage Helper Functions
// ============================================================================

fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    
    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} bytes", bytes)
    }
}

#[tauri::command]
fn storage_list_sources() -> Vec<StorageSource> {
    vec![
        StorageSource {
            id: "1".to_string(),
            name: "production-footage".to_string(),
            r#type: "s3".to_string(),
            path: None,
            bucket: Some("production-footage".to_string()),
            region: Some("us-west-2".to_string()),
            connected: true,
            status: "connected".to_string(),
        },
        StorageSource {
            id: "2".to_string(),
            name: "FSx Projects".to_string(),
            r#type: "fsxn".to_string(),
            path: Some("/fsx/projects".to_string()),
            bucket: None,
            region: None,
            connected: true,
            status: "connected".to_string(),
        },
        StorageSource {
            id: "3".to_string(),
            name: "NVMe Cache".to_string(),
            r#type: "local".to_string(),
            path: Some("/cache".to_string()),
            bucket: None,
            region: None,
            connected: true,
            status: "connected".to_string(),
        },
    ]
}

#[tauri::command]
fn storage_mount(request: MountRequest) -> Result<StorageSource, String> {
    Ok(StorageSource {
        id: format!("{}", Utc::now().timestamp_millis()),
        name: request.name,
        r#type: request.r#type,
        path: request.path,
        bucket: request.bucket,
        region: request.region,
        connected: true,
        status: "connected".to_string(),
    })
}

#[tauri::command]
fn storage_list_files(_source_id: String, path: String) -> Vec<FileMetadata> {
    // Return different files based on path for demo
    if path.contains("Project Files") {
        return vec![
            FileMetadata {
                id: "20".to_string(),
                name: "Scene 1".to_string(),
                path: "/Project Files/Scene 1".to_string(),
                size: 0,
                size_human: "--".to_string(),
                last_modified: "2025-01-14".to_string(),
                is_directory: true,
                tier_status: "hot".to_string(),
                can_warm: false,
                is_cached: true,
                can_transcode: false,
                transcode_status: None,
            },
            FileMetadata {
                id: "21".to_string(),
                name: "Scene 2".to_string(),
                path: "/Project Files/Scene 2".to_string(),
                size: 0,
                size_human: "--".to_string(),
                last_modified: "2025-01-13".to_string(),
                is_directory: true,
                tier_status: "cold".to_string(),
                can_warm: true,
                is_cached: false,
                can_transcode: false,
                transcode_status: None,
            },
        ];
    }
    
    if path.contains("Archive") {
        return vec![
            FileMetadata {
                id: "30".to_string(),
                name: "2024_projects.tar.gz".to_string(),
                path: "/Archive/2024_projects.tar.gz".to_string(),
                size: 150_000_000_000,
                size_human: format_size(150_000_000_000),
                last_modified: "2024-12-31".to_string(),
                is_directory: false,
                tier_status: "archive".to_string(),
                can_warm: true,
                is_cached: false,
                can_transcode: false,
                transcode_status: None,
            },
        ];
    }
    
    vec![
        FileMetadata {
            id: "1".to_string(),
            name: "Project Files".to_string(),
            path: "/Project Files".to_string(),
            size: 0,
            size_human: "--".to_string(),
            last_modified: "2025-01-15".to_string(),
            is_directory: true,
            tier_status: "hot".to_string(),
            can_warm: false,
            is_cached: true,
            can_transcode: false,
            transcode_status: None,
        },
        FileMetadata {
            id: "2".to_string(),
            name: "footage_4k_001.mov".to_string(),
            path: "/footage_4k_001.mov".to_string(),
            size: 15_000_000_000,
            size_human: format_size(15_000_000_000),
            last_modified: "2025-01-10".to_string(),
            is_directory: false,
            tier_status: "cold".to_string(),
            can_warm: true,
            is_cached: false,
            can_transcode: true,
            transcode_status: None,
        },
        FileMetadata {
            id: "3".to_string(),
            name: "interview_raw.mp4".to_string(),
            path: "/interview_raw.mp4".to_string(),
            size: 8_500_000_000,
            size_human: format_size(8_500_000_000),
            last_modified: "2025-01-12".to_string(),
            is_directory: false,
            tier_status: "cold".to_string(),
            can_warm: true,
            is_cached: false,
            can_transcode: true,
            transcode_status: None,
        },
        FileMetadata {
            id: "4".to_string(),
            name: "b-roll_drone.mov".to_string(),
            path: "/b-roll_drone.mov".to_string(),
            size: 22_000_000_000,
            size_human: format_size(22_000_000_000),
            last_modified: "2025-01-08".to_string(),
            is_directory: false,
            tier_status: "hot".to_string(),
            can_warm: false,
            is_cached: true,
            can_transcode: true,
            transcode_status: None,
        },
        FileMetadata {
            id: "5".to_string(),
            name: "sound_design.wav".to_string(),
            path: "/sound_design.wav".to_string(),
            size: 500_000_000,
            size_human: format_size(500_000_000),
            last_modified: "2025-01-14".to_string(),
            is_directory: false,
            tier_status: "warm".to_string(),
            can_warm: true,
            is_cached: false,
            can_transcode: false,
            transcode_status: None,
        },
        FileMetadata {
            id: "6".to_string(),
            name: "final_export_v3.mp4".to_string(),
            path: "/final_export_v3.mp4".to_string(),
            size: 4_200_000_000,
            size_human: format_size(4_200_000_000),
            last_modified: "2025-01-15".to_string(),
            is_directory: false,
            tier_status: "hot".to_string(),
            can_warm: false,
            is_cached: true,
            can_transcode: true,
            transcode_status: None,
        },
        FileMetadata {
            id: "7".to_string(),
            name: "Archive".to_string(),
            path: "/Archive".to_string(),
            size: 0,
            size_human: "--".to_string(),
            last_modified: "2024-12-01".to_string(),
            is_directory: true,
            tier_status: "archive".to_string(),
            can_warm: true,
            is_cached: false,
            can_transcode: false,
            transcode_status: None,
        },
    ]
}

#[tauri::command]
fn storage_warm_file(request: WarmRequest) -> Result<String, String> {
    tracing::info!("Warming file: {} from source {}", request.file_path, request.source_id);
    Ok(format!("Started warming: {}", request.file_path))
}

#[tauri::command]
fn storage_transcode_video(request: TranscodeRequest) -> Result<String, String> {
    tracing::info!("Transcoding: {} to {}", request.file_path, request.format);
    Ok(format!("Started transcoding {} to {}", request.file_path, request.format))
}

#[tauri::command]
fn storage_unmount(_source_id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn storage_file_info(source_id: String, path: String) -> Result<FileMetadata, String> {
    let files = storage_list_files(source_id, "".to_string());
    files.into_iter()
        .find(|f| f.path == path)
        .ok_or_else(|| "File not found".to_string())
}

// ============================================================================
// Application Entry Point
// ============================================================================

/// Configure and run the Tauri application
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize tracing
    tracing_subscriber::fmt::init();
    
    // Initialize VFS state for clean architecture commands
    let vfs_state = VfsStateWrapper::new();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(vfs_state)
        .setup(|app| {
            // Start the metrics polling in background
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                gpu::start_metrics_polling(handle);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Developer tools
            toggle_devtools,
            open_devtools,
            close_devtools,
            // GPU & System commands
            commands::get_gpu_info,
            commands::get_gpu_metrics,
            commands::get_system_info,
            commands::get_all_metrics,
            commands::start_model,
            commands::stop_model,
            commands::get_model_status,
            // VFS Clean Architecture commands
            vfs::commands::vfs_init,
            vfs::commands::vfs_list_sources,
            vfs::commands::vfs_mount_local,
            vfs::commands::vfs_list_files,
            vfs::commands::vfs_warm_file,
            vfs::commands::vfs_transcode_video,
            vfs::commands::vfs_cache_stats,
            vfs::commands::vfs_clear_cache,
            // VFS POSIX file operations
            vfs::commands::vfs_mkdir,
            vfs::commands::vfs_mkdir_p,
            vfs::commands::vfs_rmdir,
            vfs::commands::vfs_rename,
            vfs::commands::vfs_copy,
            vfs::commands::vfs_move,
            vfs::commands::vfs_delete,
            vfs::commands::vfs_delete_recursive,
            vfs::commands::vfs_chmod,
            vfs::commands::vfs_stat,
            vfs::commands::vfs_touch,
            vfs::commands::vfs_exists,
            vfs::commands::vfs_read_text,
            vfs::commands::vfs_write_text,
            vfs::commands::vfs_append_text,
            // VFS Clipboard commands - Copy/Paste between Native and VFS
            vfs::commands::vfs_clipboard_copy,
            vfs::commands::vfs_clipboard_cut,
            vfs::commands::vfs_clipboard_copy_native,
            vfs::commands::vfs_clipboard_copy_for_native,
            vfs::commands::vfs_clipboard_get,
            vfs::commands::vfs_clipboard_has_files,
            vfs::commands::vfs_clipboard_clear,
            vfs::commands::vfs_clipboard_paste_to_vfs,
            vfs::commands::vfs_clipboard_paste_to_native,
            vfs::commands::vfs_clipboard_read_native,
            vfs::commands::vfs_clipboard_write_native,
            // VFS Tags & Favorites commands
            vfs::commands::vfs_get_metadata,
            vfs::commands::vfs_add_tag,
            vfs::commands::vfs_remove_tag,
            vfs::commands::vfs_toggle_favorite,
            vfs::commands::vfs_set_favorite,
            vfs::commands::vfs_set_color_label,
            vfs::commands::vfs_set_rating,
            vfs::commands::vfs_set_comment,
            vfs::commands::vfs_list_favorites,
            vfs::commands::vfs_list_by_tag,
            vfs::commands::vfs_list_by_color,
            vfs::commands::vfs_list_all_tags,
            // VFS Cross-Storage commands (move between storage sources)
            vfs::commands::vfs_copy_to_source,
            vfs::commands::vfs_move_to_source,
            vfs::commands::vfs_get_transfer_targets,
            vfs::commands::vfs_batch_copy_to_source,
            vfs::commands::vfs_batch_move_to_source,
            // VFS Sync commands (S3 ↔ FSx ONTAP, tiering, NVMe cache)
            vfs::commands::vfs_sync,
            vfs::commands::vfs_get_sync_targets,
            vfs::commands::vfs_change_tier,
            vfs::commands::vfs_check_nvme_cache,
            vfs::commands::vfs_set_tags,
            vfs::commands::vfs_reveal_in_finder,
            // VFS Open file commands
            vfs::commands::vfs_open_file,
            vfs::commands::vfs_open_file_with,
            vfs::commands::vfs_get_apps_for_file,
            vfs::commands::vfs_get_os_preferences,
            // Storage commands for Finder UI
            storage_list_sources,
            storage_mount,
            storage_list_files,
            storage_warm_file,
            storage_transcode_video,
            storage_unmount,
            storage_file_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
