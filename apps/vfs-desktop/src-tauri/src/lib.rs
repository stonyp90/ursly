//! Ursly VFS - Virtual Cloud File System
//!
//! A multi-tier cloud storage file browser with DAM/MAM features.

pub mod vfs;
pub mod gpu;
pub mod system;
pub mod commands;

use tauri::{Manager, tray::TrayIconEvent};
use vfs::commands::VfsStateWrapper;

// ============================================================================
// Window Commands
// ============================================================================

#[tauri::command]
fn show_window(window: tauri::Window) {
    if let Some(webview_window) = window.get_webview_window("main") {
        let _ = webview_window.show();
        let _ = webview_window.set_focus();
    }
}

#[tauri::command]
fn hide_window(window: tauri::Window) {
    if let Some(webview_window) = window.get_webview_window("main") {
        let _ = webview_window.hide();
    }
}

#[tauri::command]
fn toggle_window(window: tauri::Window) {
    if let Some(webview_window) = window.get_webview_window("main") {
        if webview_window.is_visible().unwrap_or(false) {
            let _ = webview_window.hide();
        } else {
            let _ = webview_window.show();
            let _ = webview_window.set_focus();
        }
    }
}

// ============================================================================
// Developer Tools Toggle
// ============================================================================

#[tauri::command]
fn toggle_devtools(window: tauri::Window) {
    #[cfg(debug_assertions)]
    if let Some(webview_window) = window.get_webview_window("main") {
        let _ = webview_window.eval("console.log('DevTools toggled')");
    }
}

#[tauri::command]
fn open_devtools(_window: tauri::Window) {
    #[cfg(debug_assertions)]
    tracing::info!("DevTools can be opened via right-click -> Inspect Element");
}

#[tauri::command]
fn close_devtools(_window: tauri::Window) {
    #[cfg(debug_assertions)]
    tracing::info!("DevTools closed");
}

// ============================================================================
// Application Entry Point
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();
    
    let vfs_state = VfsStateWrapper::new();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(vfs_state)
        .setup(|app| {
            // Start GPU metrics polling
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                gpu::start_metrics_polling(handle);
            });
            
            // Setup tray icon click handler
            let app_handle = app.handle().clone();
            if let Some(tray) = app.tray_by_id("main") {
                tray.on_tray_icon_event(move |_tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                });
            }
            
            // Show window on startup for dev mode
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            show_window,
            hide_window,
            toggle_window,
            toggle_devtools,
            open_devtools,
            close_devtools,
            // GPU & System metrics commands
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
            vfs::commands::vfs_eject,
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
            // VFS Clipboard commands
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
            // VFS Cross-Storage commands
            vfs::commands::vfs_copy_to_source,
            vfs::commands::vfs_move_to_source,
            vfs::commands::vfs_get_transfer_targets,
            vfs::commands::vfs_batch_copy_to_source,
            vfs::commands::vfs_batch_move_to_source,
            // VFS Sync commands
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
            vfs::commands::vfs_get_thumbnail,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
