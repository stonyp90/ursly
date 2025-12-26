//! Clipboard Adapter - Platform-specific clipboard implementation
//!
//! Handles copy/paste between native filesystem and VFS across all platforms:
//! - macOS: NSPasteboard with file URLs
//! - Windows: Clipboard with CF_HDROP
//! - Linux: X11/Wayland with text/uri-list

use anyhow::{Context, Result};
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::vfs::ports::clipboard::{
    ClipboardContent, ClipboardOperation, ClipboardSource, IClipboardService, PasteResult,
};
use crate::vfs::ports::{CopyOptions, IFileOperations, MoveOptions};
use crate::vfs::application::VfsService;

/// Clipboard adapter for cross-platform file operations
pub struct ClipboardAdapter {
    /// Internal clipboard storage (for VFS-to-VFS operations)
    internal_clipboard: RwLock<Option<ClipboardContent>>,
    
    /// Reference to VFS service for file operations
    vfs_service: Option<Arc<VfsService>>,
}

impl ClipboardAdapter {
    /// Create a new clipboard adapter
    pub fn new() -> Self {
        Self {
            internal_clipboard: RwLock::new(None),
            vfs_service: None,
        }
    }
    
    /// Create with VFS service reference
    pub fn with_vfs_service(vfs_service: Arc<VfsService>) -> Self {
        Self {
            internal_clipboard: RwLock::new(None),
            vfs_service: Some(vfs_service),
        }
    }
    
    /// Set VFS service after creation
    pub fn set_vfs_service(&mut self, vfs_service: Arc<VfsService>) {
        self.vfs_service = Some(vfs_service);
    }
    
    /// Get file name from path
    fn file_name(path: &Path) -> String {
        path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unnamed".to_string())
    }
    
    /// Copy a single file from native to VFS
    async fn copy_native_to_vfs(
        &self,
        source_path: &Path,
        dest_source_id: &str,
        dest_path: &Path,
    ) -> Result<PathBuf> {
        let vfs = self.vfs_service.as_ref()
            .context("VFS service not initialized")?;
        
        let file_name = Self::file_name(source_path);
        let dest_file_path = dest_path.join(&file_name);
        
        // Read from native filesystem
        let data = tokio::fs::read(source_path).await
            .with_context(|| format!("Failed to read native file: {:?}", source_path))?;
        
        // Write to VFS
        vfs.write(dest_source_id, &dest_file_path, &data).await
            .with_context(|| format!("Failed to write to VFS: {:?}", dest_file_path))?;
        
        debug!("Copied native {:?} to VFS {:?}", source_path, dest_file_path);
        Ok(dest_file_path)
    }
    
    /// Copy a single file from VFS to native
    async fn copy_vfs_to_native(
        &self,
        source_id: &str,
        source_path: &Path,
        dest_path: &Path,
    ) -> Result<PathBuf> {
        let vfs = self.vfs_service.as_ref()
            .context("VFS service not initialized")?;
        
        let file_name = Self::file_name(source_path);
        let dest_file_path = dest_path.join(&file_name);
        
        // Read from VFS
        let data = vfs.read(source_id, source_path).await
            .with_context(|| format!("Failed to read from VFS: {:?}", source_path))?;
        
        // Write to native filesystem
        if let Some(parent) = dest_file_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        tokio::fs::write(&dest_file_path, &data).await
            .with_context(|| format!("Failed to write to native: {:?}", dest_file_path))?;
        
        debug!("Copied VFS {:?} to native {:?}", source_path, dest_file_path);
        Ok(dest_file_path)
    }
    
    /// Copy within VFS (same or different sources)
    async fn copy_vfs_to_vfs(
        &self,
        src_source_id: &str,
        source_path: &Path,
        dest_source_id: &str,
        dest_path: &Path,
    ) -> Result<PathBuf> {
        let vfs = self.vfs_service.as_ref()
            .context("VFS service not initialized")?;
        
        let file_name = Self::file_name(source_path);
        let dest_file_path = dest_path.join(&file_name);
        
        if src_source_id == dest_source_id {
            // Same source - use internal copy
            let opts = CopyOptions::default();
            vfs.copy(src_source_id, source_path, &dest_file_path, opts).await?;
        } else {
            // Different sources - read and write
            let data = vfs.read(src_source_id, source_path).await?;
            vfs.write(dest_source_id, &dest_file_path, &data).await?;
        }
        
        debug!("Copied VFS {:?} to VFS {:?}", source_path, dest_file_path);
        Ok(dest_file_path)
    }
    
    /// Copy within native filesystem
    async fn copy_native_to_native(
        &self,
        source_path: &Path,
        dest_path: &Path,
    ) -> Result<PathBuf> {
        let file_name = Self::file_name(source_path);
        let dest_file_path = dest_path.join(&file_name);
        
        if let Some(parent) = dest_file_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        
        tokio::fs::copy(source_path, &dest_file_path).await?;
        
        debug!("Copied native {:?} to native {:?}", source_path, dest_file_path);
        Ok(dest_file_path)
    }
    
    /// Export VFS files to a temp directory for native clipboard access
    /// This allows Finder/Explorer to paste VFS files
    async fn export_vfs_to_temp(
        &self,
        source_id: &str,
        paths: &[PathBuf],
    ) -> Result<Vec<PathBuf>> {
        let vfs = match &self.vfs_service {
            Some(v) => v,
            None => {
                warn!("VFS service not initialized, cannot export to clipboard");
                return Ok(Vec::new());
            }
        };
        
        // Create temp directory for exported files
        let temp_dir = std::env::temp_dir().join("ursly-clipboard");
        tokio::fs::create_dir_all(&temp_dir).await?;
        
        let mut exported_paths = Vec::new();
        
        for path in paths {
            let file_name = Self::file_name(path);
            let temp_path = temp_dir.join(&file_name);
            
            match vfs.read(source_id, path).await {
                Ok(data) => {
                    if let Err(e) = tokio::fs::write(&temp_path, &data).await {
                        warn!("Failed to export {:?} to temp: {}", path, e);
                        continue;
                    }
                    exported_paths.push(temp_path);
                    debug!("Exported VFS {:?} to temp {:?}", path, temp_dir.join(&file_name));
                }
                Err(e) => {
                    warn!("Failed to read VFS file {:?}: {}", path, e);
                }
            }
        }
        
        info!("Exported {} VFS files to temp for clipboard", exported_paths.len());
        Ok(exported_paths)
    }
}

impl Default for ClipboardAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl IClipboardService for ClipboardAdapter {
    async fn copy_files(&self, source: ClipboardSource, paths: Vec<PathBuf>) -> Result<()> {
        info!("Copying {} files to clipboard", paths.len());
        
        let content = ClipboardContent::copy(source.clone(), paths.clone());
        
        // Store internally
        let mut clipboard = self.internal_clipboard.write().await;
        *clipboard = Some(content);
        drop(clipboard);
        
        // Write to OS clipboard
        match &source {
            ClipboardSource::Native => {
                // Native files - write directly
                self.write_native_clipboard(&paths).await?;
            }
            ClipboardSource::Vfs { source_id } => {
                // VFS files - export to temp and write those paths
                let temp_paths = self.export_vfs_to_temp(source_id, &paths).await?;
                if !temp_paths.is_empty() {
                    self.write_native_clipboard(&temp_paths).await?;
                }
            }
        }
        
        Ok(())
    }
    
    async fn cut_files(&self, source: ClipboardSource, paths: Vec<PathBuf>) -> Result<()> {
        info!("Cutting {} files to clipboard", paths.len());
        
        let content = ClipboardContent::cut(source.clone(), paths.clone());
        
        let mut clipboard = self.internal_clipboard.write().await;
        *clipboard = Some(content);
        drop(clipboard);
        
        // Write to OS clipboard
        match &source {
            ClipboardSource::Native => {
                self.write_native_clipboard(&paths).await?;
            }
            ClipboardSource::Vfs { source_id } => {
                // VFS files - export to temp and write those paths
                let temp_paths = self.export_vfs_to_temp(source_id, &paths).await?;
                if !temp_paths.is_empty() {
                    self.write_native_clipboard(&temp_paths).await?;
                }
            }
        }
        
        Ok(())
    }
    
    async fn get_clipboard(&self) -> Result<Option<ClipboardContent>> {
        // First check internal clipboard
        let internal = self.internal_clipboard.read().await;
        if internal.is_some() {
            return Ok(internal.clone());
        }
        
        // Fall back to OS clipboard
        if let Some(paths) = self.read_native_clipboard().await? {
            if !paths.is_empty() {
                return Ok(Some(ClipboardContent::copy(ClipboardSource::Native, paths)));
            }
        }
        
        Ok(None)
    }
    
    async fn clear_clipboard(&self) -> Result<()> {
        let mut clipboard = self.internal_clipboard.write().await;
        *clipboard = None;
        Ok(())
    }
    
    async fn has_files(&self) -> Result<bool> {
        // Only check internal clipboard, not OS clipboard
        // This ensures consistency with our internal state
        let clipboard = self.internal_clipboard.read().await;
        Ok(clipboard.as_ref().map(|c| !c.paths.is_empty()).unwrap_or(false))
    }
    
    async fn paste_to_vfs(
        &self,
        dest_source_id: &str,
        dest_path: &Path,
    ) -> Result<PasteResult> {
        let content = self.get_clipboard().await?
            .context("Clipboard is empty")?;
        
        info!("Pasting {} files to VFS {}", content.paths.len(), dest_source_id);
        
        let mut pasted_paths = Vec::new();
        let mut errors = Vec::new();
        
        for path in &content.paths {
            let result = match &content.source {
                ClipboardSource::Native => {
                    self.copy_native_to_vfs(path, dest_source_id, dest_path).await
                }
                ClipboardSource::Vfs { source_id } => {
                    self.copy_vfs_to_vfs(source_id, path, dest_source_id, dest_path).await
                }
            };
            
            match result {
                Ok(dest) => pasted_paths.push(dest),
                Err(e) => errors.push(format!("{:?}: {}", path, e)),
            }
        }
        
        // If cut operation, delete sources after successful paste
        if content.is_cut() && errors.is_empty() {
            match &content.source {
                ClipboardSource::Native => {
                    for path in &content.paths {
                        if let Err(e) = tokio::fs::remove_file(path).await {
                            warn!("Failed to delete cut source {:?}: {}", path, e);
                        }
                    }
                }
                ClipboardSource::Vfs { source_id } => {
                    if let Some(vfs) = &self.vfs_service {
                        for path in &content.paths {
                            if let Err(e) = vfs.rm(source_id, path).await {
                                warn!("Failed to delete cut source {:?}: {}", path, e);
                            }
                        }
                    }
                }
            }
            
            // Clear clipboard after cut
            self.clear_clipboard().await?;
        }
        
        if errors.is_empty() {
            Ok(PasteResult::success(pasted_paths))
        } else {
            Ok(PasteResult::partial(pasted_paths, errors))
        }
    }
    
    async fn paste_to_native(&self, dest_path: &Path) -> Result<PasteResult> {
        let content = self.get_clipboard().await?
            .context("Clipboard is empty")?;
        
        info!("Pasting {} files to native {:?}", content.paths.len(), dest_path);
        
        let mut pasted_paths = Vec::new();
        let mut errors = Vec::new();
        
        for path in &content.paths {
            let result = match &content.source {
                ClipboardSource::Native => {
                    self.copy_native_to_native(path, dest_path).await
                }
                ClipboardSource::Vfs { source_id } => {
                    self.copy_vfs_to_native(source_id, path, dest_path).await
                }
            };
            
            match result {
                Ok(dest) => pasted_paths.push(dest),
                Err(e) => errors.push(format!("{:?}: {}", path, e)),
            }
        }
        
        // If cut, delete sources
        if content.is_cut() && errors.is_empty() {
            match &content.source {
                ClipboardSource::Native => {
                    for path in &content.paths {
                        if let Err(e) = tokio::fs::remove_file(path).await {
                            warn!("Failed to delete cut source {:?}: {}", path, e);
                        }
                    }
                }
                ClipboardSource::Vfs { source_id } => {
                    if let Some(vfs) = &self.vfs_service {
                        for path in &content.paths {
                            if let Err(e) = vfs.rm(source_id, path).await {
                                warn!("Failed to delete cut source {:?}: {}", path, e);
                            }
                        }
                    }
                }
            }
            
            self.clear_clipboard().await?;
        }
        
        // Write to OS clipboard so user can paste in Finder/Explorer
        if !pasted_paths.is_empty() {
            self.write_native_clipboard(&pasted_paths).await?;
        }
        
        if errors.is_empty() {
            Ok(PasteResult::success(pasted_paths))
        } else {
            Ok(PasteResult::partial(pasted_paths, errors))
        }
    }
    
    /// Read files from OS clipboard (Finder/Explorer copy)
    async fn read_native_clipboard(&self) -> Result<Option<Vec<PathBuf>>> {
        #[cfg(target_os = "macos")]
        {
            read_macos_clipboard().await
        }
        
        #[cfg(target_os = "windows")]
        {
            read_windows_clipboard().await
        }
        
        #[cfg(target_os = "linux")]
        {
            read_linux_clipboard().await
        }
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            Ok(None)
        }
    }
    
    /// Write files to OS clipboard (so Finder/Explorer can paste)
    async fn write_native_clipboard(&self, paths: &[PathBuf]) -> Result<()> {
        if paths.is_empty() {
            return Ok(());
        }
        
        #[cfg(target_os = "macos")]
        {
            write_macos_clipboard(paths).await
        }
        
        #[cfg(target_os = "windows")]
        {
            write_windows_clipboard(paths).await
        }
        
        #[cfg(target_os = "linux")]
        {
            write_linux_clipboard(paths).await
        }
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            warn!("Native clipboard not supported on this platform");
            Ok(())
        }
    }
}

// =============================================================================
// macOS Clipboard Implementation
// =============================================================================

#[cfg(target_os = "macos")]
async fn read_macos_clipboard() -> Result<Option<Vec<PathBuf>>> {
    use std::process::Command;
    
    // Use osascript to read file paths from clipboard
    // This handles both single and multiple file selections from Finder
    let script = r#"
use framework "AppKit"
use scripting additions

set thePaths to {}
try
    set thePasteboard to current application's NSPasteboard's generalPasteboard()
    set theURLs to thePasteboard's readObjectsForClasses:{current application's NSURL} options:(missing value)
    
    if theURLs is not missing value then
        repeat with theURL in theURLs
            if (theURL's isFileURL()) as boolean then
                set end of thePaths to (theURL's |path|()) as text
            end if
        end repeat
    end if
end try

set AppleScript's text item delimiters to linefeed
return thePaths as text
"#;
    
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output();
    
    match output {
        Ok(out) if out.status.success() => {
            let text = String::from_utf8_lossy(&out.stdout);
            let paths: Vec<PathBuf> = text
                .lines()
                .filter(|l| !l.is_empty())
                .map(|l| PathBuf::from(l.trim()))
                .filter(|p| p.exists())
                .collect();
            
            if paths.is_empty() {
                Ok(None)
            } else {
                debug!("Read {} paths from macOS clipboard", paths.len());
                Ok(Some(paths))
            }
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            if !stderr.is_empty() {
                debug!("macOS clipboard read stderr: {}", stderr);
            }
            Ok(None)
        }
        Err(e) => {
            warn!("Failed to read macOS clipboard: {}", e);
            Ok(None)
        }
    }
}

#[cfg(target_os = "macos")]
async fn write_macos_clipboard(paths: &[PathBuf]) -> Result<()> {
    use std::process::Command;
    
    if paths.is_empty() {
        return Ok(());
    }
    
    // Build the list of POSIX files for AppleScript
    let file_list: Vec<String> = paths
        .iter()
        .filter(|p| p.exists())
        .map(|p| format!(r#"(POSIX file "{}")"#, p.display()))
        .collect();
    
    if file_list.is_empty() {
        warn!("No existing files to write to clipboard");
        return Ok(());
    }
    
    // Use AppleScript with NSPasteboard for proper Finder integration
    let script = format!(
        r#"
use framework "AppKit"
use scripting additions

set thePasteboard to current application's NSPasteboard's generalPasteboard()
thePasteboard's clearContents()

set theURLs to current application's NSMutableArray's new()
{}

thePasteboard's writeObjects:theURLs
return "ok"
"#,
        paths
            .iter()
            .filter(|p| p.exists())
            .map(|p| format!(
                r#"theURLs's addObject:(current application's NSURL's fileURLWithPath:"{}")"#,
                p.display()
            ))
            .collect::<Vec<_>>()
            .join("\n")
    );
    
    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .context("Failed to write to macOS clipboard")?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        warn!("macOS clipboard write failed: {}", stderr);
        return Err(anyhow::anyhow!("Failed to write to clipboard: {}", stderr));
    }
    
    debug!("Wrote {} paths to macOS clipboard", paths.len());
    Ok(())
}

// =============================================================================
// Windows Clipboard Implementation
// =============================================================================

#[cfg(target_os = "windows")]
async fn read_windows_clipboard() -> Result<Option<Vec<PathBuf>>> {
    use std::process::Command;
    
    // Use PowerShell to read file paths (hidden window)
    let mut cmd = Command::new("powershell");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle", "Hidden",
        "-Command",
        r#"
        Add-Type -AssemblyName System.Windows.Forms
        $files = [System.Windows.Forms.Clipboard]::GetFileDropList()
        $files | ForEach-Object { Write-Output $_ }
        "#,
    ]);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let output = cmd.output();
    
    match output {
        Ok(out) if out.status.success() => {
            let text = String::from_utf8_lossy(&out.stdout);
            let paths: Vec<PathBuf> = text
                .lines()
                .filter(|l| !l.is_empty())
                .map(|l| PathBuf::from(l.trim()))
                .filter(|p| p.exists())
                .collect();
            
            if paths.is_empty() {
                Ok(None)
            } else {
                Ok(Some(paths))
            }
        }
        _ => Ok(None),
    }
}

#[cfg(target_os = "windows")]
async fn write_windows_clipboard(paths: &[PathBuf]) -> Result<()> {
    use std::process::Command;
    
    let paths_str: Vec<String> = paths
        .iter()
        .map(|p| format!("'{}'", p.display()))
        .collect();
    
    let script = format!(
        r#"
        Add-Type -AssemblyName System.Windows.Forms
        $files = New-Object System.Collections.Specialized.StringCollection
        {}
        [System.Windows.Forms.Clipboard]::SetFileDropList($files)
        "#,
        paths_str
            .iter()
            .map(|p| format!("$files.Add({})", p))
            .collect::<Vec<_>>()
            .join("\n")
    );
    
    let mut cmd = Command::new("powershell");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle", "Hidden",
        "-Command", &script
    ]);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.output()
        .context("Failed to write to Windows clipboard")?;
    
    debug!("Wrote {} paths to Windows clipboard", paths.len());
    Ok(())
}

// =============================================================================
// Linux Clipboard Implementation
// =============================================================================

#[cfg(target_os = "linux")]
async fn read_linux_clipboard() -> Result<Option<Vec<PathBuf>>> {
    use std::process::Command;
    
    // Try xclip first, then xsel
    let output = Command::new("xclip")
        .args(["-selection", "clipboard", "-o", "-t", "text/uri-list"])
        .output()
        .or_else(|_| {
            Command::new("xsel")
                .args(["--clipboard", "--output"])
                .output()
        });
    
    match output {
        Ok(out) if out.status.success() => {
            let text = String::from_utf8_lossy(&out.stdout);
            let paths: Vec<PathBuf> = text
                .lines()
                .filter(|l| l.starts_with("file://"))
                .map(|l| {
                    let path = l.strip_prefix("file://").unwrap_or(l);
                    // URL decode
                    let decoded = urlencoding::decode(path).unwrap_or_else(|_| path.into());
                    PathBuf::from(decoded.as_ref())
                })
                .filter(|p| p.exists())
                .collect();
            
            if paths.is_empty() {
                Ok(None)
            } else {
                Ok(Some(paths))
            }
        }
        _ => Ok(None),
    }
}

#[cfg(target_os = "linux")]
async fn write_linux_clipboard(paths: &[PathBuf]) -> Result<()> {
    use std::process::{Command, Stdio};
    use std::io::Write;
    
    // Convert to file:// URIs
    let uris: String = paths
        .iter()
        .map(|p| format!("file://{}", urlencoding::encode(&p.to_string_lossy())))
        .collect::<Vec<_>>()
        .join("\n");
    
    // Try xclip first
    let mut child = Command::new("xclip")
        .args(["-selection", "clipboard", "-t", "text/uri-list"])
        .stdin(Stdio::piped())
        .spawn()
        .or_else(|_| {
            Command::new("xsel")
                .args(["--clipboard", "--input"])
                .stdin(Stdio::piped())
                .spawn()
        })
        .context("Failed to open clipboard (install xclip or xsel)")?;
    
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(uris.as_bytes())?;
    }
    
    child.wait()?;
    
    debug!("Wrote {} paths to Linux clipboard", paths.len());
    Ok(())
}

// =============================================================================
// Unit Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_clipboard_copy_and_get() {
        let clipboard = ClipboardAdapter::new();
        
        let paths = vec![
            PathBuf::from("/test/file1.txt"),
            PathBuf::from("/test/file2.txt"),
        ];
        
        clipboard.copy_files(ClipboardSource::Native, paths.clone()).await.unwrap();
        
        let content = clipboard.get_clipboard().await.unwrap().unwrap();
        assert_eq!(content.paths, paths);
        assert_eq!(content.operation, ClipboardOperation::Copy);
    }
    
    #[tokio::test]
    async fn test_clipboard_cut() {
        let clipboard = ClipboardAdapter::new();
        
        let paths = vec![PathBuf::from("/test/file.txt")];
        
        clipboard.cut_files(
            ClipboardSource::Vfs { source_id: "local".to_string() },
            paths.clone(),
        ).await.unwrap();
        
        let content = clipboard.get_clipboard().await.unwrap().unwrap();
        assert!(content.is_cut());
        assert!(content.is_vfs());
    }
    
    #[tokio::test]
    async fn test_clipboard_clear() {
        let clipboard = ClipboardAdapter::new();
        
        clipboard.copy_files(
            ClipboardSource::Native,
            vec![PathBuf::from("/test/file.txt")],
        ).await.unwrap();
        
        assert!(clipboard.has_files().await.unwrap());
        
        clipboard.clear_clipboard().await.unwrap();
        
        // Internal clipboard cleared, but OS clipboard may still have content
        let internal = clipboard.internal_clipboard.read().await;
        assert!(internal.is_none());
    }
    
    #[tokio::test]
    async fn test_file_name_extraction() {
        assert_eq!(ClipboardAdapter::file_name(Path::new("/path/to/file.txt")), "file.txt");
        assert_eq!(ClipboardAdapter::file_name(Path::new("file.txt")), "file.txt");
        assert_eq!(ClipboardAdapter::file_name(Path::new("/path/to/folder")), "folder");
    }
}

