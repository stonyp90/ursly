//! Native Thumbnail Adapter - OS-level thumbnail generation
//!
//! Leverages native OS APIs for thumbnail generation:
//! - macOS: QuickLook (qlmanage) for PDF, images, videos
//! - Windows: IShellItemImageFactory (via windows-rs crate)
//! - Linux: freedesktop.org thumbnail cache (~/.cache/thumbnails/)
//!
//! Falls back to FFmpeg for videos when native support unavailable.

use anyhow::{Context, Result};
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::process::Command;
use tracing::{debug, info, warn};

use crate::vfs::ports::ThumbnailData;

/// Supported file types for native thumbnails
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThumbnailType {
    Image,
    Pdf,
    Video,
    Unknown,
}

impl ThumbnailType {
    /// Detect thumbnail type from file extension
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            // Images
            "jpg" | "jpeg" | "png" | "gif" | "bmp" | "tiff" | "tif" | "webp" | 
            "heic" | "heif" | "svg" | "ico" | "raw" | "cr2" | "nef" | "arw" |
            "dng" | "orf" | "rw2" | "pef" | "srw" | "psd" | "ai" | "eps" => ThumbnailType::Image,
            
            // PDF
            "pdf" => ThumbnailType::Pdf,
            
            // Video
            "mp4" | "mov" | "avi" | "mkv" | "wmv" | "flv" | "webm" | "m4v" |
            "mpg" | "mpeg" | "3gp" | "mxf" | "prores" | "r3d" | "braw" => ThumbnailType::Video,
            
            _ => ThumbnailType::Unknown,
        }
    }
    
    /// Check if this type is supported for native thumbnails on current OS
    pub fn is_supported(&self) -> bool {
        match self {
            ThumbnailType::Image | ThumbnailType::Pdf => true,
            ThumbnailType::Video => cfg!(target_os = "macos") || cfg!(target_os = "windows"),
            ThumbnailType::Unknown => false,
        }
    }
}

/// Native thumbnail generator using OS APIs
pub struct NativeThumbnailAdapter {
    /// Cache directory for generated thumbnails
    cache_dir: PathBuf,
    
    /// Whether the OS supports native thumbnails
    available: bool,
}

impl NativeThumbnailAdapter {
    /// Create a new native thumbnail adapter
    pub async fn new(cache_dir: PathBuf) -> Result<Self> {
        // Ensure cache directory exists
        tokio::fs::create_dir_all(&cache_dir).await?;
        
        let available = Self::check_availability().await;
        
        if available {
            info!("Native thumbnail support available");
        } else {
            warn!("Native thumbnail support not available, using fallbacks");
        }
        
        Ok(Self { cache_dir, available })
    }
    
    /// Check if native thumbnail generation is available
    async fn check_availability() -> bool {
        #[cfg(target_os = "macos")]
        {
            // Check for qlmanage (QuickLook)
            Command::new("which")
                .arg("qlmanage")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .await
                .map(|s| s.success())
                .unwrap_or(false)
        }
        
        #[cfg(target_os = "windows")]
        {
            // Windows always has shell thumbnail support
            true
        }
        
        #[cfg(target_os = "linux")]
        {
            // Check for freedesktop thumbnail cache
            let cache_path = dirs::cache_dir()
                .map(|p| p.join("thumbnails"))
                .unwrap_or_else(|| PathBuf::from("~/.cache/thumbnails"));
            cache_path.exists() || Command::new("which")
                .arg("ffmpegthumbnailer")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .await
                .map(|s| s.success())
                .unwrap_or(false)
        }
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            false
        }
    }
    
    /// Generate thumbnail for a file
    pub async fn generate_thumbnail(
        &self,
        path: &Path,
        size: u32,
    ) -> Result<ThumbnailData> {
        let ext = path.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        
        let thumb_type = ThumbnailType::from_extension(ext);
        
        if !thumb_type.is_supported() {
            return Err(anyhow::anyhow!("Unsupported file type for thumbnails: {}", ext));
        }
        
        #[cfg(target_os = "macos")]
        {
            self.generate_macos_thumbnail(path, size, thumb_type).await
        }
        
        #[cfg(target_os = "windows")]
        {
            self.generate_windows_thumbnail(path, size, thumb_type).await
        }
        
        #[cfg(target_os = "linux")]
        {
            self.generate_linux_thumbnail(path, size, thumb_type).await
        }
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            Err(anyhow::anyhow!("Native thumbnails not supported on this platform"))
        }
    }
    
    /// Generate thumbnail using macOS QuickLook
    #[cfg(target_os = "macos")]
    async fn generate_macos_thumbnail(
        &self,
        path: &Path,
        size: u32,
        _thumb_type: ThumbnailType,
    ) -> Result<ThumbnailData> {
        let output_path = self.cache_dir.join(format!(
            "thumb_{}_{}.png",
            path.file_name().unwrap_or_default().to_string_lossy(),
            uuid::Uuid::new_v4()
        ));
        
        // Use qlmanage to generate thumbnail
        // -t: thumbnail mode
        // -s: size
        // -o: output directory
        let status = Command::new("qlmanage")
            .args([
                "-t",
                "-s", &size.to_string(),
                "-o", self.cache_dir.to_str().unwrap(),
                path.to_str().unwrap(),
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await
            .context("Failed to run qlmanage")?;
        
        if !status.success() {
            return Err(anyhow::anyhow!("qlmanage failed to generate thumbnail"));
        }
        
        // qlmanage outputs to <filename>.png in output dir
        let ql_output = self.cache_dir.join(format!(
            "{}.png",
            path.file_name().unwrap_or_default().to_string_lossy()
        ));
        
        // Read the generated thumbnail
        let data = if ql_output.exists() {
            let data = tokio::fs::read(&ql_output).await?;
            tokio::fs::remove_file(&ql_output).await.ok();
            data
        } else {
            return Err(anyhow::anyhow!("Thumbnail not generated"));
        };
        
        Ok(ThumbnailData {
            data,
            timestamp: 0.0,
            width: size,
            height: size,
        })
    }
    
    /// Generate thumbnail using Windows Shell
    #[cfg(target_os = "windows")]
    async fn generate_windows_thumbnail(
        &self,
        path: &Path,
        size: u32,
        _thumb_type: ThumbnailType,
    ) -> Result<ThumbnailData> {
        use std::os::windows::ffi::OsStrExt;
        
        // Use PowerShell to extract thumbnail via Shell.Application
        let script = format!(
            r#"
            Add-Type -AssemblyName System.Drawing
            $shell = New-Object -ComObject Shell.Application
            $folder = $shell.Namespace("{}")
            $file = $folder.ParseName("{}")
            if ($file) {{
                $thumb = $file.ExtendedProperty("System.Thumbnail")
                if ($thumb) {{
                    $thumb.Save("{}")
                }}
            }}
            "#,
            path.parent().unwrap_or(path).to_string_lossy(),
            path.file_name().unwrap_or_default().to_string_lossy(),
            self.cache_dir.join("thumb.png").to_string_lossy()
        );
        
        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
            .await
            .context("Failed to run PowerShell")?;
        
        let thumb_path = self.cache_dir.join("thumb.png");
        
        if thumb_path.exists() {
            let data = tokio::fs::read(&thumb_path).await?;
            tokio::fs::remove_file(&thumb_path).await.ok();
            
            Ok(ThumbnailData {
                data,
                timestamp: 0.0,
                width: size,
                height: size,
            })
        } else {
            Err(anyhow::anyhow!("Windows thumbnail generation failed"))
        }
    }
    
    /// Generate thumbnail using Linux freedesktop thumbnailer
    #[cfg(target_os = "linux")]
    async fn generate_linux_thumbnail(
        &self,
        path: &Path,
        size: u32,
        thumb_type: ThumbnailType,
    ) -> Result<ThumbnailData> {
        let output_path = self.cache_dir.join(format!(
            "thumb_{}.png",
            uuid::Uuid::new_v4()
        ));
        
        // Try ffmpegthumbnailer for videos
        if thumb_type == ThumbnailType::Video {
            let status = Command::new("ffmpegthumbnailer")
                .args([
                    "-i", path.to_str().unwrap(),
                    "-o", output_path.to_str().unwrap(),
                    "-s", &size.to_string(),
                ])
                .status()
                .await;
            
            if let Ok(status) = status {
                if status.success() {
                    let data = tokio::fs::read(&output_path).await?;
                    tokio::fs::remove_file(&output_path).await.ok();
                    
                    return Ok(ThumbnailData {
                        data,
                        timestamp: 0.0,
                        width: size,
                        height: size,
                    });
                }
            }
        }
        
        // For images and PDFs, use ImageMagick convert
        let status = Command::new("convert")
            .args([
                &format!("{}[0]", path.to_str().unwrap()), // [0] for first page of PDF
                "-thumbnail", &format!("{}x{}", size, size),
                "-background", "white",
                "-alpha", "remove",
                output_path.to_str().unwrap(),
            ])
            .status()
            .await
            .context("Failed to run ImageMagick convert")?;
        
        if !status.success() {
            return Err(anyhow::anyhow!("ImageMagick thumbnail generation failed"));
        }
        
        let data = tokio::fs::read(&output_path).await?;
        tokio::fs::remove_file(&output_path).await.ok();
        
        Ok(ThumbnailData {
            data,
            timestamp: 0.0,
            width: size,
            height: size,
        })
    }
    
    /// Check if native thumbnail support is available
    pub fn is_available(&self) -> bool {
        self.available
    }
    
    /// Get supported file extensions for thumbnails
    pub fn supported_extensions() -> Vec<&'static str> {
        vec![
            // Images
            "jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "webp",
            "heic", "heif", "svg", "ico", "psd", "ai", "eps",
            // RAW formats
            "raw", "cr2", "nef", "arw", "dng", "orf", "rw2", "pef", "srw",
            // PDF
            "pdf",
            // Video
            "mp4", "mov", "avi", "mkv", "wmv", "flv", "webm", "m4v",
            "mpg", "mpeg", "3gp", "mxf", "prores", "r3d", "braw",
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_thumbnail_type_detection() {
        assert_eq!(ThumbnailType::from_extension("jpg"), ThumbnailType::Image);
        assert_eq!(ThumbnailType::from_extension("JPEG"), ThumbnailType::Image);
        assert_eq!(ThumbnailType::from_extension("pdf"), ThumbnailType::Pdf);
        assert_eq!(ThumbnailType::from_extension("PDF"), ThumbnailType::Pdf);
        assert_eq!(ThumbnailType::from_extension("mp4"), ThumbnailType::Video);
        assert_eq!(ThumbnailType::from_extension("MOV"), ThumbnailType::Video);
        assert_eq!(ThumbnailType::from_extension("xyz"), ThumbnailType::Unknown);
    }
    
    #[test]
    fn test_image_extensions_supported() {
        for ext in ["jpg", "png", "gif", "heic", "psd"] {
            assert_eq!(
                ThumbnailType::from_extension(ext),
                ThumbnailType::Image,
                "Extension {} should be Image",
                ext
            );
        }
    }
    
    #[test]
    fn test_raw_extensions_supported() {
        for ext in ["cr2", "nef", "arw", "dng", "raw"] {
            assert_eq!(
                ThumbnailType::from_extension(ext),
                ThumbnailType::Image,
                "RAW extension {} should be Image",
                ext
            );
        }
    }
    
    #[test]
    fn test_video_extensions_supported() {
        for ext in ["mp4", "mov", "avi", "mkv", "prores", "mxf"] {
            assert_eq!(
                ThumbnailType::from_extension(ext),
                ThumbnailType::Video,
                "Extension {} should be Video",
                ext
            );
        }
    }
    
    #[test]
    fn test_supported_extensions_list() {
        let extensions = NativeThumbnailAdapter::supported_extensions();
        assert!(extensions.contains(&"jpg"));
        assert!(extensions.contains(&"pdf"));
        assert!(extensions.contains(&"mp4"));
        assert!(extensions.len() > 30);
    }
    
    #[tokio::test]
    async fn test_adapter_creation() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = NativeThumbnailAdapter::new(temp_dir.path().to_path_buf())
            .await
            .unwrap();
        
        // Should have been created
        assert!(temp_dir.path().exists());
    }
}
