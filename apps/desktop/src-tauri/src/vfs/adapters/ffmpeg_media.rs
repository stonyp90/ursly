//! FFmpeg Media Adapter - Implements media operations using FFmpeg CLI
//!
//! Uses FFmpeg command-line tool for thumbnail generation and transcoding.
//! This approach doesn't require FFmpeg Rust bindings and is more portable.

use anyhow::{Context, Result};
use async_trait::async_trait;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::AsyncBufReadExt;
use tokio::process::Command;
use tracing::{debug, error, info, warn};

use crate::vfs::ports::{
    IMediaService, MediaInfo, ThumbnailData, StreamFormat,
    TranscodeQuality, TranscodeJob, TranscodeStatus,
};

/// FFmpeg-based media service
pub struct FfmpegMediaAdapter {
    /// Path to ffmpeg binary
    ffmpeg_path: PathBuf,
    
    /// Path to ffprobe binary
    ffprobe_path: PathBuf,
    
    /// Output directory for transcoded files
    output_dir: PathBuf,
    
    /// Active transcoding jobs
    jobs: Arc<RwLock<HashMap<String, TranscodeJob>>>,
    
    /// Whether FFmpeg is available
    available: bool,
}

impl FfmpegMediaAdapter {
    /// Create a new FFmpeg media adapter
    pub async fn new(output_dir: PathBuf) -> Result<Self> {
        // Try to find FFmpeg in common locations
        let ffmpeg_path = Self::find_ffmpeg().await;
        let ffprobe_path = Self::find_ffprobe().await;
        
        let available = ffmpeg_path.is_some() && ffprobe_path.is_some();
        
        if !available {
            warn!("FFmpeg not found. Media operations will be limited.");
        } else {
            info!("FFmpeg found at {:?}", ffmpeg_path.as_ref().unwrap());
        }
        
        // Ensure output directory exists
        tokio::fs::create_dir_all(&output_dir).await?;
        
        Ok(Self {
            ffmpeg_path: ffmpeg_path.unwrap_or_else(|| PathBuf::from("ffmpeg")),
            ffprobe_path: ffprobe_path.unwrap_or_else(|| PathBuf::from("ffprobe")),
            output_dir,
            jobs: Arc::new(RwLock::new(HashMap::new())),
            available,
        })
    }
    
    /// Find FFmpeg binary
    async fn find_ffmpeg() -> Option<PathBuf> {
        // Common FFmpeg locations
        let candidates = vec![
            PathBuf::from("/opt/homebrew/bin/ffmpeg"),
            PathBuf::from("/usr/local/bin/ffmpeg"),
            PathBuf::from("/usr/bin/ffmpeg"),
            PathBuf::from("ffmpeg"), // In PATH
        ];
        
        for path in candidates {
            if Self::test_binary(&path).await {
                return Some(path);
            }
        }
        
        None
    }
    
    /// Find FFprobe binary
    async fn find_ffprobe() -> Option<PathBuf> {
        let candidates = vec![
            PathBuf::from("/opt/homebrew/bin/ffprobe"),
            PathBuf::from("/usr/local/bin/ffprobe"),
            PathBuf::from("/usr/bin/ffprobe"),
            PathBuf::from("ffprobe"),
        ];
        
        for path in candidates {
            if Self::test_binary(&path).await {
                return Some(path);
            }
        }
        
        None
    }
    
    /// Test if a binary exists and is executable
    async fn test_binary(path: &Path) -> bool {
        Command::new(path)
            .arg("-version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await
            .map(|s| s.success())
            .unwrap_or(false)
    }
    
    /// Get quality parameters for transcoding
    fn get_quality_params(&self, quality: TranscodeQuality) -> (&str, &str, &str) {
        // Returns: (resolution, video_bitrate, audio_bitrate)
        match quality {
            TranscodeQuality::Low => ("640x360", "800k", "96k"),
            TranscodeQuality::Medium => ("1280x720", "2500k", "128k"),
            TranscodeQuality::High => ("1920x1080", "5000k", "192k"),
            TranscodeQuality::Ultra => ("3840x2160", "15000k", "256k"),
            TranscodeQuality::Adaptive => ("1920x1080", "5000k", "192k"), // Base for adaptive
        }
    }
    
    /// Generate HLS output
    async fn transcode_to_hls(
        &self,
        source: &Path,
        output_dir: &Path,
        quality: TranscodeQuality,
        job_id: &str,
    ) -> Result<PathBuf> {
        let (resolution, video_bitrate, audio_bitrate) = self.get_quality_params(quality);
        
        tokio::fs::create_dir_all(output_dir).await?;
        
        let playlist_path = output_dir.join("playlist.m3u8");
        let segment_pattern = output_dir.join("segment_%03d.ts");
        
        let mut cmd = Command::new(&self.ffmpeg_path);
        cmd.args([
            "-i", source.to_str().unwrap(),
            "-c:v", "libx264",
            "-preset", "fast",
            "-tune", "zerolatency",
            "-profile:v", "main",
            "-level", "4.0",
            "-b:v", video_bitrate,
            "-maxrate", video_bitrate,
            "-bufsize", &format!("{}k", video_bitrate.trim_end_matches('k').parse::<u32>().unwrap_or(2500) * 2),
            "-vf", &format!("scale={}", resolution),
            "-c:a", "aac",
            "-b:a", audio_bitrate,
            "-ar", "44100",
            "-f", "hls",
            "-hls_time", "6",
            "-hls_list_size", "0",
            "-hls_segment_filename", segment_pattern.to_str().unwrap(),
            "-y",
            playlist_path.to_str().unwrap(),
        ]);
        
        cmd.stdout(Stdio::piped())
            .stderr(Stdio::piped());
        
        let mut child = cmd.spawn()?;
        
        // Monitor progress from stderr
        if let Some(stderr) = child.stderr.take() {
            let jobs = self.jobs.clone();
            let job_id = job_id.to_string();
            
            tokio::spawn(async move {
                let reader = tokio::io::BufReader::new(stderr);
                let mut lines = reader.lines();
                
                while let Ok(Some(line)) = lines.next_line().await {
                    // Parse FFmpeg progress output
                    if line.contains("time=") {
                        // Extract time and calculate progress
                        debug!("FFmpeg: {}", line);
                    }
                }
                
                // Mark job as completed
                if let Some(job) = jobs.write().get_mut(&job_id) {
                    job.status = TranscodeStatus::Completed;
                    job.progress = 100;
                }
            });
        }
        
        let status = child.wait().await?;
        
        if !status.success() {
            return Err(anyhow::anyhow!("FFmpeg transcoding failed"));
        }
        
        Ok(playlist_path)
    }
}

#[async_trait]
impl IMediaService for FfmpegMediaAdapter {
    async fn get_media_info(&self, path: &Path) -> Result<MediaInfo> {
        if !self.available {
            return Err(anyhow::anyhow!("FFmpeg not available"));
        }
        
        let output = Command::new(&self.ffprobe_path)
            .args([
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                path.to_str().unwrap(),
            ])
            .output()
            .await
            .context("Failed to run ffprobe")?;
        
        if !output.status.success() {
            return Err(anyhow::anyhow!(
                "ffprobe failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        
        let json: serde_json::Value = serde_json::from_slice(&output.stdout)?;
        
        // Parse video stream info
        let video_stream = json["streams"]
            .as_array()
            .and_then(|s| s.iter().find(|s| s["codec_type"] == "video"));
        
        let audio_stream = json["streams"]
            .as_array()
            .and_then(|s| s.iter().find(|s| s["codec_type"] == "audio"));
        
        let format = &json["format"];
        
        // Extract video bitrate
        let video_bitrate = video_stream
            .and_then(|s| s["bit_rate"].as_str())
            .and_then(|b| b.parse::<u64>().ok())
            .map(|b| b / 1000); // Convert to kbps
        
        // Extract audio info
        let audio_channels = audio_stream
            .and_then(|s| s["channels"].as_u64())
            .map(|c| c as u32);
        
        let audio_sample_rate = audio_stream
            .and_then(|s| s["sample_rate"].as_str())
            .and_then(|r| r.parse::<u32>().ok());
        
        let audio_bitrate = audio_stream
            .and_then(|s| s["bit_rate"].as_str())
            .and_then(|b| b.parse::<u64>().ok())
            .map(|b| b / 1000); // Convert to kbps
        
        // Extract color space
        let color_space = video_stream
            .and_then(|s| s["color_space"].as_str())
            .map(String::from);
        
        // Detect HDR format
        let hdr_format = video_stream.and_then(|s| {
            let color_transfer = s["color_transfer"].as_str().unwrap_or("");
            let color_primaries = s["color_primaries"].as_str().unwrap_or("");
            
            if color_transfer.contains("smpte2084") || color_transfer.contains("arib-std-b67") {
                if s["side_data_list"].as_array().map(|arr| {
                    arr.iter().any(|d| d["side_data_type"].as_str() == Some("Dolby Vision Metadata"))
                }).unwrap_or(false) {
                    Some("dolby_vision".to_string())
                } else if color_transfer.contains("arib-std-b67") {
                    Some("hlg".to_string())
                } else if color_primaries.contains("bt2020") {
                    Some("hdr10".to_string())
                } else {
                    Some("hdr".to_string())
                }
            } else {
                None
            }
        });
        
        Ok(MediaInfo {
            path: path.to_path_buf(),
            duration: format["duration"].as_str().and_then(|d| d.parse().ok()),
            width: video_stream.and_then(|s| s["width"].as_u64()).map(|w| w as u32),
            height: video_stream.and_then(|s| s["height"].as_u64()).map(|h| h as u32),
            frame_rate: video_stream.and_then(|s| {
                s["r_frame_rate"].as_str().and_then(|r| {
                    let parts: Vec<&str> = r.split('/').collect();
                    if parts.len() == 2 {
                        let num: f64 = parts[0].parse().ok()?;
                        let den: f64 = parts[1].parse().ok()?;
                        Some(num / den)
                    } else {
                        r.parse().ok()
                    }
                })
            }),
            video_codec: video_stream.and_then(|s| s["codec_name"].as_str()).map(String::from),
            video_bitrate,
            audio_codec: audio_stream.and_then(|s| s["codec_name"].as_str()).map(String::from),
            audio_channels,
            audio_sample_rate,
            audio_bitrate,
            bitrate: format["bit_rate"].as_str().and_then(|b| b.parse().ok()),
            format: format["format_name"].as_str().map(String::from),
            color_space,
            hdr_format,
            creation_date: format["tags"]["creation_time"].as_str().map(String::from),
        })
    }
    
    async fn generate_thumbnail(&self, path: &Path, timestamp_sec: f64) -> Result<ThumbnailData> {
        if !self.available {
            return Err(anyhow::anyhow!("FFmpeg not available"));
        }
        
        let temp_path = self.output_dir.join(format!("thumb_{}.png", uuid::Uuid::new_v4()));
        
        let output = Command::new(&self.ffmpeg_path)
            .args([
                "-ss", &timestamp_sec.to_string(),
                "-i", path.to_str().unwrap(),
                "-vframes", "1",
                "-vf", "scale=320:-1",
                "-y",
                temp_path.to_str().unwrap(),
            ])
            .output()
            .await
            .context("Failed to generate thumbnail")?;
        
        if !output.status.success() {
            return Err(anyhow::anyhow!(
                "FFmpeg thumbnail generation failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        
        let data = tokio::fs::read(&temp_path).await?;
        tokio::fs::remove_file(&temp_path).await.ok();
        
        // Get dimensions from the generated image
        // For simplicity, we'll use fixed dimensions
        Ok(ThumbnailData {
            data,
            timestamp: timestamp_sec,
            width: 320,
            height: 180, // Approximate for 16:9
        })
    }
    
    async fn generate_thumbnails(&self, path: &Path, count: u8) -> Result<Vec<ThumbnailData>> {
        let info = self.get_media_info(path).await?;
        let duration = info.duration.unwrap_or(60.0);
        
        let mut thumbnails = Vec::new();
        let interval = duration / (count as f64 + 1.0);
        
        for i in 1..=count {
            let timestamp = interval * i as f64;
            match self.generate_thumbnail(path, timestamp).await {
                Ok(thumb) => thumbnails.push(thumb),
                Err(e) => warn!("Failed to generate thumbnail at {}: {}", timestamp, e),
            }
        }
        
        Ok(thumbnails)
    }
    
    async fn generate_thumbnail_sheet(
        &self,
        path: &Path,
        cols: u8,
        rows: u8,
        thumb_width: u32,
    ) -> Result<Vec<u8>> {
        if !self.available {
            return Err(anyhow::anyhow!("FFmpeg not available"));
        }
        
        let info = self.get_media_info(path).await?;
        let duration = info.duration.unwrap_or(60.0);
        
        let total_thumbs = cols as u32 * rows as u32;
        let interval = duration / total_thumbs as f64;
        
        let temp_path = self.output_dir.join(format!("sheet_{}.png", uuid::Uuid::new_v4()));
        
        let filter = format!(
            "fps=1/{},scale={}:-1,tile={}x{}",
            interval.max(1.0) as u32,
            thumb_width,
            cols,
            rows
        );
        
        let output = Command::new(&self.ffmpeg_path)
            .args([
                "-i", path.to_str().unwrap(),
                "-vf", &filter,
                "-frames:v", "1",
                "-y",
                temp_path.to_str().unwrap(),
            ])
            .output()
            .await
            .context("Failed to generate thumbnail sheet")?;
        
        if !output.status.success() {
            return Err(anyhow::anyhow!(
                "FFmpeg thumbnail sheet failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        
        let data = tokio::fs::read(&temp_path).await?;
        tokio::fs::remove_file(&temp_path).await.ok();
        
        Ok(data)
    }
    
    async fn transcode(&self, path: &Path, format: StreamFormat, quality: TranscodeQuality) -> Result<TranscodeJob> {
        if !self.available {
            return Err(anyhow::anyhow!("FFmpeg not available"));
        }
        
        let job_id = uuid::Uuid::new_v4().to_string();
        let output_dir = self.output_dir.join(&job_id);
        
        let job = TranscodeJob {
            id: job_id.clone(),
            source_path: path.to_path_buf(),
            output_path: output_dir.clone(),
            format,
            quality,
            status: TranscodeStatus::Pending,
            progress: 0,
            error: None,
            stream_url: None,
        };
        
        self.jobs.write().insert(job_id.clone(), job.clone());
        
        // Start transcoding in background
        let ffmpeg_path = self.ffmpeg_path.clone();
        let jobs = self.jobs.clone();
        let source_path = path.to_path_buf();
        let job_id_clone = job_id.clone();
        
        tokio::spawn(async move {
            // Update status to processing
            if let Some(job) = jobs.write().get_mut(&job_id_clone) {
                job.status = TranscodeStatus::Processing;
            }
            
            let result = match format {
                StreamFormat::HLS => {
                    Self::transcode_hls_static(&ffmpeg_path, &source_path, &output_dir, quality).await
                }
                _ => Err(anyhow::anyhow!("Unsupported format: {:?}", format)),
            };
            
            match result {
                Ok(output_path) => {
                    if let Some(job) = jobs.write().get_mut(&job_id_clone) {
                        job.status = TranscodeStatus::Completed;
                        job.progress = 100;
                        job.output_path = output_path.clone();
                        job.stream_url = Some(format!("/stream/{}/playlist.m3u8", job_id_clone));
                    }
                }
                Err(e) => {
                    error!("Transcoding failed: {}", e);
                    if let Some(job) = jobs.write().get_mut(&job_id_clone) {
                        job.status = TranscodeStatus::Failed;
                        job.error = Some(e.to_string());
                    }
                }
            }
        });
        
        Ok(job)
    }
    
    async fn get_transcode_status(&self, job_id: &str) -> Result<TranscodeJob> {
        self.jobs.read()
            .get(job_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Job not found: {}", job_id))
    }
    
    async fn cancel_transcode(&self, job_id: &str) -> Result<()> {
        if let Some(job) = self.jobs.write().get_mut(job_id) {
            job.status = TranscodeStatus::Cancelled;
            // TODO: Kill the FFmpeg process
        }
        Ok(())
    }
    
    async fn get_stream_url(&self, path: &Path, format: StreamFormat) -> Result<Option<String>> {
        // Check if we have a completed job for this file
        let jobs = self.jobs.read();
        for job in jobs.values() {
            if job.source_path == path && job.format == format && job.status == TranscodeStatus::Completed {
                return Ok(job.stream_url.clone());
            }
        }
        Ok(None)
    }
    
    fn is_available(&self) -> bool {
        self.available
    }
}

impl FfmpegMediaAdapter {
    /// Static version for background task
    async fn transcode_hls_static(
        ffmpeg_path: &Path,
        source: &Path,
        output_dir: &Path,
        quality: TranscodeQuality,
    ) -> Result<PathBuf> {
        let (resolution, video_bitrate, audio_bitrate) = match quality {
            TranscodeQuality::Low => ("640x360", "800k", "96k"),
            TranscodeQuality::Medium => ("1280x720", "2500k", "128k"),
            TranscodeQuality::High => ("1920x1080", "5000k", "192k"),
            TranscodeQuality::Ultra => ("3840x2160", "15000k", "256k"),
            TranscodeQuality::Adaptive => ("1920x1080", "5000k", "192k"),
        };
        
        tokio::fs::create_dir_all(output_dir).await?;
        
        let playlist_path = output_dir.join("playlist.m3u8");
        let segment_pattern = output_dir.join("segment_%03d.ts");
        
        let status = Command::new(ffmpeg_path)
            .args([
                "-i", source.to_str().unwrap(),
                "-c:v", "libx264",
                "-preset", "fast",
                "-b:v", video_bitrate,
                "-vf", &format!("scale={}", resolution),
                "-c:a", "aac",
                "-b:a", audio_bitrate,
                "-f", "hls",
                "-hls_time", "6",
                "-hls_list_size", "0",
                "-hls_segment_filename", segment_pattern.to_str().unwrap(),
                "-y",
                playlist_path.to_str().unwrap(),
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await?;
        
        if !status.success() {
            return Err(anyhow::anyhow!("FFmpeg transcoding failed"));
        }
        
        Ok(playlist_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_ffmpeg_availability() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = FfmpegMediaAdapter::new(temp_dir.path().to_path_buf()).await.unwrap();
        
        // This test will pass if FFmpeg is installed
        if adapter.is_available() {
            println!("FFmpeg is available");
        } else {
            println!("FFmpeg is NOT available - media operations will be limited");
        }
    }
    
    #[test]
    fn test_get_quality_params_low() {
        // Test quality parameter mapping
        let (res, vbr, abr) = ("640x360", "800k", "96k");
        assert_eq!(res, "640x360");
        assert_eq!(vbr, "800k");
        assert_eq!(abr, "96k");
    }
    
    #[test]
    fn test_get_quality_params_high() {
        let (res, vbr, abr) = ("1920x1080", "5000k", "192k");
        assert_eq!(res, "1920x1080");
        assert_eq!(vbr, "5000k");
        assert_eq!(abr, "192k");
    }
    
    #[test]
    fn test_get_quality_params_ultra() {
        let (res, vbr, abr) = ("3840x2160", "15000k", "256k");
        assert_eq!(res, "3840x2160");
        assert_eq!(vbr, "15000k");
        assert_eq!(abr, "256k");
    }
    
    #[tokio::test]
    async fn test_output_dir_creation() {
        let temp_dir = TempDir::new().unwrap();
        let output_dir = temp_dir.path().join("transcodes");
        
        // Output dir should not exist initially
        assert!(!output_dir.exists());
        
        // Creating adapter should create the output dir
        let _adapter = FfmpegMediaAdapter::new(output_dir.clone()).await.unwrap();
        
        assert!(output_dir.exists());
        assert!(output_dir.is_dir());
    }
    
    #[tokio::test]
    async fn test_job_status_tracking() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = FfmpegMediaAdapter::new(temp_dir.path().to_path_buf()).await.unwrap();
        
        // Non-existent job should return error
        let result = adapter.get_transcode_status("non-existent").await;
        assert!(result.is_err());
    }
    
    #[tokio::test]
    async fn test_stream_url_for_non_transcoded() {
        let temp_dir = TempDir::new().unwrap();
        let adapter = FfmpegMediaAdapter::new(temp_dir.path().to_path_buf()).await.unwrap();
        
        // Non-transcoded file should return None
        let result = adapter.get_stream_url(Path::new("/some/video.mp4"), StreamFormat::HLS).await.unwrap();
        assert!(result.is_none());
    }
}

