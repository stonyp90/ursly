//! Media Service Port - Interface for media operations
//!
//! Defines the contract for thumbnail generation, transcoding, and media info.

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::Duration;

/// Information about a media file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaInfo {
    /// File path
    pub path: PathBuf,
    
    /// Duration in seconds (video/audio)
    pub duration: Option<f64>,
    
    /// Width in pixels (video/image)
    pub width: Option<u32>,
    
    /// Height in pixels (video/image)
    pub height: Option<u32>,
    
    /// Frame rate (video)
    pub frame_rate: Option<f64>,
    
    /// Video codec
    pub video_codec: Option<String>,
    
    /// Video bitrate in kbps
    pub video_bitrate: Option<u64>,
    
    /// Audio codec
    pub audio_codec: Option<String>,
    
    /// Audio channels (1=mono, 2=stereo, 6=5.1, 8=7.1)
    pub audio_channels: Option<u32>,
    
    /// Audio sample rate in Hz
    pub audio_sample_rate: Option<u32>,
    
    /// Audio bitrate in kbps
    pub audio_bitrate: Option<u64>,
    
    /// Total bitrate in bits per second
    pub bitrate: Option<u64>,
    
    /// File format container (mp4, mkv, mov, etc.)
    pub format: Option<String>,
    
    /// Color space (bt709, bt2020, etc.)
    pub color_space: Option<String>,
    
    /// HDR format if applicable (hdr10, dolby_vision, hlg)
    pub hdr_format: Option<String>,
    
    /// Creation date
    pub creation_date: Option<String>,
}

/// Thumbnail data with timing information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailData {
    /// PNG image data
    pub data: Vec<u8>,
    
    /// Timestamp in the video (seconds)
    pub timestamp: f64,
    
    /// Width of thumbnail
    pub width: u32,
    
    /// Height of thumbnail
    pub height: u32,
}

/// Streaming format options
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum StreamFormat {
    /// HTTP Live Streaming
    HLS,
    /// MPEG-DASH
    DASH,
    /// WebRTC for low-latency
    WebRTC,
    /// Secure Reliable Transport
    SRT,
    /// Network Device Interface
    NDI,
    /// Progressive MP4 download
    MP4,
}

impl StreamFormat {
    pub fn as_str(&self) -> &'static str {
        match self {
            StreamFormat::HLS => "hls",
            StreamFormat::DASH => "dash",
            StreamFormat::WebRTC => "webrtc",
            StreamFormat::SRT => "srt",
            StreamFormat::NDI => "ndi",
            StreamFormat::MP4 => "mp4",
        }
    }
    
    pub fn extension(&self) -> &'static str {
        match self {
            StreamFormat::HLS => "m3u8",
            StreamFormat::DASH => "mpd",
            StreamFormat::WebRTC => "",
            StreamFormat::SRT => "",
            StreamFormat::NDI => "",
            StreamFormat::MP4 => "mp4",
        }
    }
}

/// Transcoding quality preset
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum TranscodeQuality {
    Low,     // 480p, low bitrate
    Medium,  // 720p, medium bitrate
    High,    // 1080p, high bitrate
    Ultra,   // 4K, maximum bitrate
    Adaptive, // Multi-bitrate for streaming
}

/// Transcoding job status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscodeJob {
    /// Unique job ID
    pub id: String,
    
    /// Source file path
    pub source_path: PathBuf,
    
    /// Output path
    pub output_path: PathBuf,
    
    /// Output format
    pub format: StreamFormat,
    
    /// Quality preset
    pub quality: TranscodeQuality,
    
    /// Current status
    pub status: TranscodeStatus,
    
    /// Progress (0-100)
    pub progress: u8,
    
    /// Error message if failed
    pub error: Option<String>,
    
    /// Stream URL when ready
    pub stream_url: Option<String>,
}

/// Status of a transcoding job
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum TranscodeStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Cancelled,
}

/// Media service interface
#[async_trait]
pub trait IMediaService: Send + Sync {
    /// Get media file information
    async fn get_media_info(&self, path: &Path) -> Result<MediaInfo>;
    
    /// Generate a single thumbnail at specified timestamp
    async fn generate_thumbnail(&self, path: &Path, timestamp_sec: f64) -> Result<ThumbnailData>;
    
    /// Generate multiple thumbnails evenly distributed
    async fn generate_thumbnails(&self, path: &Path, count: u8) -> Result<Vec<ThumbnailData>>;
    
    /// Generate a thumbnail sheet (sprite)
    async fn generate_thumbnail_sheet(
        &self,
        path: &Path,
        cols: u8,
        rows: u8,
        thumb_width: u32,
    ) -> Result<Vec<u8>>;
    
    /// Start transcoding to streaming format
    async fn transcode(&self, path: &Path, format: StreamFormat, quality: TranscodeQuality) -> Result<TranscodeJob>;
    
    /// Get transcoding job status
    async fn get_transcode_status(&self, job_id: &str) -> Result<TranscodeJob>;
    
    /// Cancel a transcoding job
    async fn cancel_transcode(&self, job_id: &str) -> Result<()>;
    
    /// Get stream URL for a file (if transcoded)
    async fn get_stream_url(&self, path: &Path, format: StreamFormat) -> Result<Option<String>>;
    
    /// Check if FFmpeg is available
    fn is_available(&self) -> bool;
}


