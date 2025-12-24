//! Cross-platform file permissions and ACL support
//!
//! Provides unified permission handling for Windows ACLs and Unix permissions.

use anyhow::{Context, Result};
use std::path::Path;
use tracing::{debug, warn};

/// File permission information (cross-platform)
#[derive(Debug, Clone)]
pub struct FilePermissions {
    /// Unix-style mode (0o644, etc.) - approximated on Windows
    pub mode: u32,
    /// Owner can read
    pub owner_read: bool,
    /// Owner can write
    pub owner_write: bool,
    /// Owner can execute
    pub owner_execute: bool,
    /// Group can read
    pub group_read: bool,
    /// Group can write
    pub group_write: bool,
    /// Group can execute
    pub group_execute: bool,
    /// Others can read
    pub others_read: bool,
    /// Others can write
    pub others_write: bool,
    /// Others can execute
    pub others_execute: bool,
    /// Is read-only (platform-specific)
    pub read_only: bool,
    /// Is hidden (Windows attribute)
    pub hidden: bool,
    /// Is system file (Windows attribute)
    pub system: bool,
}

impl Default for FilePermissions {
    fn default() -> Self {
        Self {
            mode: 0o644,
            owner_read: true,
            owner_write: true,
            owner_execute: false,
            group_read: true,
            group_write: false,
            group_execute: false,
            others_read: true,
            others_write: false,
            others_execute: false,
            read_only: false,
            hidden: false,
            system: false,
        }
    }
}

impl FilePermissions {
    /// Create from Unix mode
    pub fn from_mode(mode: u32) -> Self {
        Self {
            mode,
            owner_read: mode & 0o400 != 0,
            owner_write: mode & 0o200 != 0,
            owner_execute: mode & 0o100 != 0,
            group_read: mode & 0o040 != 0,
            group_write: mode & 0o020 != 0,
            group_execute: mode & 0o010 != 0,
            others_read: mode & 0o004 != 0,
            others_write: mode & 0o002 != 0,
            others_execute: mode & 0o001 != 0,
            read_only: mode & 0o200 == 0,
            hidden: false,
            system: false,
        }
    }
    
    /// Convert to Unix mode
    pub fn to_mode(&self) -> u32 {
        let mut mode = 0u32;
        if self.owner_read { mode |= 0o400; }
        if self.owner_write { mode |= 0o200; }
        if self.owner_execute { mode |= 0o100; }
        if self.group_read { mode |= 0o040; }
        if self.group_write { mode |= 0o020; }
        if self.group_execute { mode |= 0o010; }
        if self.others_read { mode |= 0o004; }
        if self.others_write { mode |= 0o002; }
        if self.others_execute { mode |= 0o001; }
        mode
    }
}

/// Get file permissions for a path
pub fn get_permissions(path: &Path) -> Result<FilePermissions> {
    #[cfg(unix)]
    {
        get_permissions_unix(path)
    }
    
    #[cfg(windows)]
    {
        get_permissions_windows(path)
    }
    
    #[cfg(not(any(unix, windows)))]
    {
        Ok(FilePermissions::default())
    }
}

/// Set file permissions for a path
pub fn set_permissions(path: &Path, perms: &FilePermissions) -> Result<()> {
    #[cfg(unix)]
    {
        set_permissions_unix(path, perms)
    }
    
    #[cfg(windows)]
    {
        set_permissions_windows(path, perms)
    }
    
    #[cfg(not(any(unix, windows)))]
    {
        warn!("set_permissions not implemented for this platform");
        Ok(())
    }
}

/// Set file mode (chmod equivalent)
pub fn chmod(path: &Path, mode: u32) -> Result<()> {
    let perms = FilePermissions::from_mode(mode);
    set_permissions(path, &perms)
}

/// Set file owner (chown equivalent) - Unix only, no-op on Windows
pub fn chown(path: &Path, uid: Option<u32>, gid: Option<u32>) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::chown as unix_chown;
        unix_chown(path, uid, gid)
            .with_context(|| format!("Failed to chown: {:?}", path))?;
        Ok(())
    }
    
    #[cfg(not(unix))]
    {
        let _ = (path, uid, gid);
        debug!("chown is not supported on this platform");
        Ok(())
    }
}

// =============================================================================
// Unix Implementation
// =============================================================================

#[cfg(unix)]
fn get_permissions_unix(path: &Path) -> Result<FilePermissions> {
    use std::os::unix::fs::PermissionsExt;
    
    let metadata = std::fs::metadata(path)
        .with_context(|| format!("Failed to get metadata: {:?}", path))?;
    let mode = metadata.permissions().mode() & 0o777;
    
    Ok(FilePermissions::from_mode(mode))
}

#[cfg(unix)]
fn set_permissions_unix(path: &Path, perms: &FilePermissions) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    
    let mode = perms.to_mode();
    let permissions = std::fs::Permissions::from_mode(mode);
    std::fs::set_permissions(path, permissions)
        .with_context(|| format!("Failed to set permissions: {:?}", path))?;
    
    Ok(())
}

// =============================================================================
// Windows Implementation
// =============================================================================

#[cfg(windows)]
fn get_permissions_windows(path: &Path) -> Result<FilePermissions> {
    use std::os::windows::fs::MetadataExt;
    
    let metadata = std::fs::metadata(path)
        .with_context(|| format!("Failed to get metadata: {:?}", path))?;
    
    let attrs = metadata.file_attributes();
    let read_only = attrs & 0x1 != 0;  // FILE_ATTRIBUTE_READONLY
    let hidden = attrs & 0x2 != 0;     // FILE_ATTRIBUTE_HIDDEN
    let system = attrs & 0x4 != 0;     // FILE_ATTRIBUTE_SYSTEM
    
    // Map Windows attributes to Unix-style permissions
    let mode = if read_only { 0o444 } else { 0o644 };
    
    let mut perms = FilePermissions::from_mode(mode);
    perms.read_only = read_only;
    perms.hidden = hidden;
    perms.system = system;
    
    Ok(perms)
}

#[cfg(windows)]
fn set_permissions_windows(path: &Path, perms: &FilePermissions) -> Result<()> {
    use std::fs;
    
    let metadata = fs::metadata(path)?;
    let mut permissions = metadata.permissions();
    
    // Set read-only based on write permissions
    permissions.set_readonly(!perms.owner_write);
    fs::set_permissions(path, permissions)?;
    
    // Set hidden/system attributes via Windows API
    if perms.hidden || perms.system {
        set_windows_attributes(path, perms.hidden, perms.system)?;
    }
    
    Ok(())
}

#[cfg(windows)]
fn set_windows_attributes(path: &Path, hidden: bool, system: bool) -> Result<()> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::{
        GetFileAttributesW, SetFileAttributesW,
        FILE_ATTRIBUTE_HIDDEN, FILE_ATTRIBUTE_SYSTEM,
    };
    
    let wide: Vec<u16> = OsStr::new(path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    
    unsafe {
        let mut attrs = GetFileAttributesW(PCWSTR::from_raw(wide.as_ptr()));
        
        if attrs.0 == 0xFFFFFFFF {
            return Err(anyhow::anyhow!("Failed to get file attributes"));
        }
        
        if hidden {
            attrs |= FILE_ATTRIBUTE_HIDDEN;
        } else {
            attrs &= !FILE_ATTRIBUTE_HIDDEN;
        }
        
        if system {
            attrs |= FILE_ATTRIBUTE_SYSTEM;
        } else {
            attrs &= !FILE_ATTRIBUTE_SYSTEM;
        }
        
        SetFileAttributesW(PCWSTR::from_raw(wide.as_ptr()), attrs)?;
    }
    
    Ok(())
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    
    #[test]
    fn test_from_mode() {
        let perms = FilePermissions::from_mode(0o755);
        assert!(perms.owner_read);
        assert!(perms.owner_write);
        assert!(perms.owner_execute);
        assert!(perms.group_read);
        assert!(!perms.group_write);
        assert!(perms.group_execute);
        assert!(perms.others_read);
        assert!(!perms.others_write);
        assert!(perms.others_execute);
    }
    
    #[test]
    fn test_to_mode() {
        let perms = FilePermissions::from_mode(0o644);
        assert_eq!(perms.to_mode(), 0o644);
    }
    
    #[test]
    fn test_get_permissions() {
        let temp_file = NamedTempFile::new().unwrap();
        let perms = get_permissions(temp_file.path()).unwrap();
        
        // File should be readable
        assert!(perms.owner_read);
    }
    
    #[cfg(unix)]
    #[test]
    fn test_chmod_unix() {
        let temp_file = NamedTempFile::new().unwrap();
        
        chmod(temp_file.path(), 0o755).unwrap();
        
        let perms = get_permissions(temp_file.path()).unwrap();
        assert!(perms.owner_execute);
    }
}



