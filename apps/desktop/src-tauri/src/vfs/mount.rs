use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;
use parking_lot::RwLock;
use tracing::{info, error};

use super::filesystem::UrslyFS;
use super::hydration::HydratedOperator;
use super::types::{MountConfig, MountStatus};

/// Global mount state
pub struct MountState {
    pub status: Arc<RwLock<MountStatus>>,
    pub mount_handle: Arc<RwLock<Option<thread::JoinHandle<()>>>>,
}

impl MountState {
    pub fn new() -> Self {
        Self {
            status: Arc::new(RwLock::new(MountStatus {
                mounted: false,
                mount_point: None,
                cache_path: None,
                cache_size: 0,
                cache_hits: 0,
                cache_misses: 0,
            })),
            mount_handle: Arc::new(RwLock::new(None)),
        }
    }
}

/// Mount a virtual drive with the given configuration
pub async fn mount_virtual_drive(
    config: MountConfig,
    mount_state: Arc<MountState>,
) -> Result<()> {
    info!("Mounting virtual drive at {:?}", config.mount_point);
    
    // Check if already mounted
    {
        let status = mount_state.status.read();
        if status.mounted {
            return Err(anyhow::anyhow!("Already mounted"));
        }
    }
    
    // Create cache directory if it doesn't exist
    tokio::fs::create_dir_all(&config.local_cache.cache_path)
        .await
        .context("Failed to create cache directory")?;
    
    // Initialize HydratedOperator
    let operator = HydratedOperator::new(
        &config.remote.bucket,
        &config.remote.region,
        &config.local_cache.cache_path,
        config.remote.access_key.clone(),
        config.remote.secret_key.clone(),
    )
    .await?;
    
    // Create filesystem
    let fs = UrslyFS::new(operator);
    
    // Clone data for the mount thread
    let mount_point = config.mount_point.clone();
    let cache_path = config.local_cache.cache_path.clone();
    let status_clone = mount_state.status.clone();
    
    // Spawn mount thread
    let handle = thread::spawn(move || {
        info!("Starting FUSE mount loop");
        
        // Platform-specific mount options
        let options = get_mount_options(&mount_point);
        
        match fuser::mount2(fs, &mount_point, &options) {
            Ok(_) => {
                info!("FUSE mount completed successfully");
            }
            Err(e) => {
                error!("FUSE mount failed: {}", e);
                // Update status on error
                let mut status = status_clone.write();
                status.mounted = false;
                status.mount_point = None;
            }
        }
    });
    
    // Store handle
    *mount_state.mount_handle.write() = Some(handle);
    
    // Update status
    {
        let mut status = mount_state.status.write();
        status.mounted = true;
        status.mount_point = Some(config.mount_point.clone());
        status.cache_path = Some(cache_path);
    }
    
    info!("✓ Virtual drive mounted at {:?}", config.mount_point);
    Ok(())
}

/// Unmount the virtual drive
pub async fn unmount_virtual_drive(mount_state: Arc<MountState>) -> Result<()> {
    info!("Unmounting virtual drive");
    
    let mount_point = {
        let status = mount_state.status.read();
        if !status.mounted {
            return Err(anyhow::anyhow!("Not mounted"));
        }
        status.mount_point.clone()
    };
    
    if let Some(mount_point) = mount_point {
        // Platform-specific unmount
        #[cfg(target_os = "macos")]
        {
            use std::process::Command;
            Command::new("umount")
                .arg(&mount_point)
                .output()
                .context("Failed to unmount")?;
        }
        
        #[cfg(target_os = "linux")]
        {
            use std::process::Command;
            Command::new("fusermount")
                .arg("-u")
                .arg(&mount_point)
                .output()
                .context("Failed to unmount")?;
        }
        
        #[cfg(target_os = "windows")]
        {
            // Dokan unmount
            // TODO: Implement Windows unmount
        }
        
        info!("✓ Virtual drive unmounted");
    }
    
    // Update status
    {
        let mut status = mount_state.status.write();
        status.mounted = false;
        status.mount_point = None;
    }
    
    Ok(())
}

/// Get platform-specific mount options
fn get_mount_options(mount_point: &Path) -> Vec<fuser::MountOption> {
    let mut options = vec![
        fuser::MountOption::FSName("urslyfs".to_string()),
        fuser::MountOption::RO, // Read-only for POC
        fuser::MountOption::AutoUnmount,
    ];
    
    #[cfg(target_os = "macos")]
    {
        options.push(fuser::MountOption::AllowOther);
        options.push(fuser::MountOption::Subtype("ursly".to_string()));
    }
    
    #[cfg(target_os = "linux")]
    {
        options.push(fuser::MountOption::AllowOther);
    }
    
    options
}


