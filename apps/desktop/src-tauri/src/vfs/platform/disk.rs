//! Cross-platform disk space utilities
//!
//! Provides disk space calculation that works on Windows, macOS, and Linux.

use anyhow::{Context, Result};
use std::path::Path;
use tracing::debug;

/// Disk space information
#[derive(Debug, Clone, Copy)]
pub struct DiskSpace {
    /// Total space in bytes
    pub total: u64,
    /// Available (free) space in bytes
    pub available: u64,
    /// Used space in bytes
    pub used: u64,
}

impl DiskSpace {
    /// Calculate usage percentage (0.0 - 100.0)
    pub fn usage_percent(&self) -> f64 {
        if self.total == 0 {
            return 0.0;
        }
        (self.used as f64 / self.total as f64) * 100.0
    }
}

/// Get disk space for a path
pub fn get_disk_space(path: &Path) -> Result<DiskSpace> {
    debug!("Getting disk space for: {:?}", path);
    
    #[cfg(unix)]
    {
        get_disk_space_unix(path)
    }
    
    #[cfg(windows)]
    {
        get_disk_space_windows(path)
    }
    
    #[cfg(not(any(unix, windows)))]
    {
        Err(anyhow::anyhow!("Unsupported platform"))
    }
}

/// Get available space in bytes
pub fn get_available_space(path: &Path) -> Result<u64> {
    Ok(get_disk_space(path)?.available)
}

/// Get total space in bytes
pub fn get_total_space(path: &Path) -> Result<u64> {
    Ok(get_disk_space(path)?.total)
}

// =============================================================================
// Unix Implementation (macOS, Linux)
// =============================================================================

#[cfg(unix)]
fn get_disk_space_unix(path: &Path) -> Result<DiskSpace> {
    use nix::sys::statvfs::statvfs;
    
    let stat = statvfs(path)
        .with_context(|| format!("Failed to get disk space for: {:?}", path))?;
    
    let block_size = stat.block_size() as u64;
    let total = stat.blocks() as u64 * block_size;
    let available = stat.blocks_available() as u64 * block_size;
    let used = total.saturating_sub(available);
    
    Ok(DiskSpace { total, available, used })
}

// =============================================================================
// Windows Implementation
// =============================================================================

#[cfg(windows)]
fn get_disk_space_windows(path: &Path) -> Result<DiskSpace> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;
    
    // Convert path to wide string
    let path_str = path.to_string_lossy();
    let root = get_volume_root(&path_str);
    let wide: Vec<u16> = OsStr::new(&root)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    
    let mut free_bytes_available: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut total_free_bytes: u64 = 0;
    
    unsafe {
        let result = GetDiskFreeSpaceExW(
            PCWSTR::from_raw(wide.as_ptr()),
            Some(&mut free_bytes_available as *mut u64),
            Some(&mut total_bytes as *mut u64),
            Some(&mut total_free_bytes as *mut u64),
        );
        
        if result.is_err() {
            return Err(anyhow::anyhow!("GetDiskFreeSpaceExW failed for: {}", root));
        }
    }
    
    Ok(DiskSpace {
        total: total_bytes,
        available: free_bytes_available,
        used: total_bytes.saturating_sub(total_free_bytes),
    })
}

/// Get the volume root from a Windows path
#[cfg(windows)]
fn get_volume_root(path: &str) -> String {
    // Handle UNC paths: \\server\share -> \\server\share\
    if path.starts_with("\\\\") {
        let parts: Vec<&str> = path.trim_start_matches("\\\\").splitn(3, '\\').collect();
        if parts.len() >= 2 {
            return format!("\\\\{}\\{}\\", parts[0], parts[1]);
        }
    }
    
    // Handle drive letters: C:\path -> C:\
    if path.len() >= 2 && path.chars().nth(1) == Some(':') {
        return format!("{}\\", &path[..2]);
    }
    
    // Fallback to the path itself
    path.to_string()
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_get_disk_space() {
        let temp_dir = TempDir::new().unwrap();
        let space = get_disk_space(temp_dir.path()).unwrap();
        
        // Basic sanity checks
        assert!(space.total > 0, "Total space should be > 0");
        assert!(space.available <= space.total, "Available should be <= total");
        assert!(space.used <= space.total, "Used should be <= total");
    }
    
    #[test]
    fn test_usage_percent() {
        let space = DiskSpace {
            total: 1000,
            available: 250,
            used: 750,
        };
        
        assert!((space.usage_percent() - 75.0).abs() < 0.01);
    }
    
    #[test]
    fn test_usage_percent_empty_disk() {
        let space = DiskSpace {
            total: 0,
            available: 0,
            used: 0,
        };
        
        assert_eq!(space.usage_percent(), 0.0);
    }
    
    #[cfg(windows)]
    #[test]
    fn test_get_volume_root_drive_letter() {
        assert_eq!(get_volume_root("C:\\Users\\test"), "C:\\");
        assert_eq!(get_volume_root("D:\\Projects\\code"), "D:\\");
    }
    
    #[cfg(windows)]
    #[test]
    fn test_get_volume_root_unc() {
        assert_eq!(get_volume_root("\\\\server\\share\\folder"), "\\\\server\\share\\");
        assert_eq!(get_volume_root("\\\\192.168.1.1\\data\\files"), "\\\\192.168.1.1\\data\\");
    }
}



