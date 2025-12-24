//! Cross-platform path utilities
//!
//! Handles UNC paths, path separators, and path normalization.

use std::path::{Path, PathBuf, Component};

/// Path type classification
#[derive(Debug, Clone, PartialEq)]
pub enum PathType {
    /// Local filesystem path (e.g., /home/user or C:\Users)
    Local,
    /// UNC path (e.g., \\server\share)
    Unc { server: String, share: String },
    /// Relative path
    Relative,
}

/// Classify a path
pub fn classify_path(path: &Path) -> PathType {
    let path_str = path.to_string_lossy();
    
    // Check for UNC path
    if path_str.starts_with("\\\\") || path_str.starts_with("//") {
        if let Some((server, share)) = parse_unc_path(&path_str) {
            return PathType::Unc { server, share };
        }
    }
    
    // Check if absolute
    if path.is_absolute() {
        return PathType::Local;
    }
    
    PathType::Relative
}

/// Parse UNC path into server and share components
pub fn parse_unc_path(path: &str) -> Option<(String, String)> {
    let normalized = path.replace('/', "\\");
    let trimmed = normalized.trim_start_matches("\\\\");
    
    let parts: Vec<&str> = trimmed.splitn(3, '\\').collect();
    if parts.len() >= 2 {
        Some((parts[0].to_string(), parts[1].to_string()))
    } else {
        None
    }
}

/// Check if path is a UNC path
pub fn is_unc_path(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    path_str.starts_with("\\\\") || path_str.starts_with("//")
}

/// Normalize path separators to the current platform
pub fn normalize_separators(path: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        // Convert forward slashes to backslashes on Windows
        let path_str = path.to_string_lossy().replace('/', "\\");
        PathBuf::from(path_str)
    }
    
    #[cfg(not(windows))]
    {
        // Convert backslashes to forward slashes on Unix
        let path_str = path.to_string_lossy().replace('\\', "/");
        PathBuf::from(path_str)
    }
}

/// Normalize a path (resolve ., .., and normalize separators)
pub fn normalize_path(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    
    for component in path.components() {
        match component {
            Component::ParentDir => {
                normalized.pop();
            }
            Component::CurDir => {
                // Skip current directory references
            }
            _ => {
                normalized.push(component);
            }
        }
    }
    
    normalize_separators(&normalized)
}

/// Join paths safely, handling platform-specific issues
pub fn safe_join(base: &Path, relative: &Path) -> PathBuf {
    let relative = relative.strip_prefix("/").unwrap_or(relative);
    let relative = relative.strip_prefix("\\").unwrap_or(relative);
    
    let joined = base.join(relative);
    normalize_separators(&joined)
}

/// Get the relative path from one path to another
pub fn relative_to(path: &Path, base: &Path) -> Option<PathBuf> {
    path.strip_prefix(base).ok().map(|p| p.to_path_buf())
}

/// Convert a path to use forward slashes (for VFS internal use)
pub fn to_vfs_path(path: &Path) -> String {
    let path_str = path.to_string_lossy();
    path_str.replace('\\', "/")
}

/// Convert VFS path (with forward slashes) to platform path
pub fn from_vfs_path(vfs_path: &str) -> PathBuf {
    normalize_separators(&PathBuf::from(vfs_path))
}

/// Get UNC server from path (Windows only, returns None on other platforms)
pub fn get_unc_server(path: &Path) -> Option<String> {
    if let PathType::Unc { server, .. } = classify_path(path) {
        Some(server)
    } else {
        None
    }
}

/// Get the root of a path (drive letter on Windows, / on Unix)
pub fn get_root(path: &Path) -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let path_str = path.to_string_lossy();
        
        // UNC path root
        if let Some((server, share)) = parse_unc_path(&path_str) {
            return Some(PathBuf::from(format!("\\\\{}\\{}", server, share)));
        }
        
        // Drive letter root
        if path_str.len() >= 2 && path_str.chars().nth(1) == Some(':') {
            return Some(PathBuf::from(format!("{}\\", &path_str[..2])));
        }
        
        None
    }
    
    #[cfg(not(windows))]
    {
        if path.is_absolute() {
            Some(PathBuf::from("/"))
        } else {
            None
        }
    }
}

/// Check if a path is within another path (prevents directory traversal)
pub fn is_within(child: &Path, parent: &Path) -> bool {
    let child_normalized = normalize_path(child);
    let parent_normalized = normalize_path(parent);
    
    child_normalized.starts_with(&parent_normalized)
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_classify_local_path() {
        #[cfg(unix)]
        {
            assert_eq!(classify_path(Path::new("/home/user")), PathType::Local);
        }
        
        #[cfg(windows)]
        {
            assert_eq!(classify_path(Path::new("C:\\Users")), PathType::Local);
        }
    }
    
    #[test]
    fn test_classify_relative_path() {
        assert_eq!(classify_path(Path::new("relative/path")), PathType::Relative);
    }
    
    #[test]
    fn test_parse_unc_path() {
        let result = parse_unc_path("\\\\server\\share\\folder");
        assert_eq!(result, Some(("server".to_string(), "share".to_string())));
        
        let result = parse_unc_path("//server/share/folder");
        assert_eq!(result, Some(("server".to_string(), "share".to_string())));
    }
    
    #[test]
    fn test_is_unc_path() {
        assert!(is_unc_path(Path::new("\\\\server\\share")));
        assert!(is_unc_path(Path::new("//server/share")));
        assert!(!is_unc_path(Path::new("/home/user")));
        assert!(!is_unc_path(Path::new("C:\\Users")));
    }
    
    #[test]
    fn test_normalize_path() {
        let path = Path::new("/home/user/../user2/./docs");
        let normalized = normalize_path(path);
        
        #[cfg(unix)]
        assert_eq!(normalized, PathBuf::from("/home/user2/docs"));
    }
    
    #[test]
    fn test_safe_join() {
        let base = Path::new("/home/user");
        let relative = Path::new("/subdir/file.txt");
        let joined = safe_join(base, relative);
        
        #[cfg(unix)]
        assert_eq!(joined, PathBuf::from("/home/user/subdir/file.txt"));
    }
    
    #[test]
    fn test_to_vfs_path() {
        let path = Path::new("dir\\subdir\\file.txt");
        assert_eq!(to_vfs_path(path), "dir/subdir/file.txt");
    }
    
    #[test]
    fn test_is_within() {
        let parent = Path::new("/home/user");
        let child = Path::new("/home/user/docs/file.txt");
        let outside = Path::new("/home/other/file.txt");
        
        assert!(is_within(child, parent));
        assert!(!is_within(outside, parent));
    }
    
    #[test]
    fn test_is_within_traversal_attack() {
        let parent = Path::new("/home/user");
        let attack = Path::new("/home/user/../other/secret.txt");
        
        assert!(!is_within(attack, parent));
    }
}



