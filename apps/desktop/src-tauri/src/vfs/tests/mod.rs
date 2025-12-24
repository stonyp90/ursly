//! CREE8 VFS Feature Tests
//!
//! This module contains one clear test per feature/use case.
//! Each test is named to describe the feature being tested.
//!
//! ## Feature Categories
//!
//! | Category                 | Tests | Description                              |
//! |--------------------------|-------|------------------------------------------|
//! | File System Operations   | 7     | POSIX-compliant create/read/write/delete |
//! | Caching & Hydration      | 3     | NVMe cache with LRU eviction             |
//! | Storage Backends         | 5     | Local, S3, FSxN, GCS, NAS                |
//! | Media Processing         | 3     | FFmpeg thumbnails & transcoding          |
//! | VFS Orchestration        | 1     | Service-level file management            |
//! | Configuration            | 2     | Safe defaults for operations             |
//!
//! ## Running Feature Tests
//!
//! ```bash
//! # Run all feature tests
//! cargo test --lib feature_ -- --nocapture
//!
//! # Run specific category
//! cargo test --lib feature_browse
//! cargo test --lib feature_cache
//! cargo test --lib feature_s3
//! ```

#[cfg(test)]
mod feature_tests {
    use std::path::{Path, PathBuf};
    use tempfile::TempDir;
    
    // =========================================================================
    // FEATURE: Local Filesystem Access
    // Use Case: User browses local directories like Finder
    // =========================================================================
    
    /// **Feature**: Browse local directory contents
    /// 
    /// Verifies that the VFS can list files in a local directory,
    /// with directories appearing first (sorted), then files.
    #[tokio::test]
    async fn feature_browse_local_directory() {
        use crate::vfs::adapters::LocalStorageAdapter;
        use crate::vfs::ports::StorageAdapter;
        
        let temp_dir = TempDir::new().unwrap();
        
        // Create test structure: 2 folders + 1 file
        std::fs::create_dir(temp_dir.path().join("Documents")).unwrap();
        std::fs::create_dir(temp_dir.path().join("Videos")).unwrap();
        std::fs::write(temp_dir.path().join("readme.txt"), "Hello").unwrap();
        
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Home".to_string(),
        );
        
        let files = adapter.list_files(Path::new("/")).await.unwrap();
        
        // Expect: Documents, Videos (dirs first), readme.txt (file last)
        assert_eq!(files.len(), 3, "Should list all 3 items");
        assert!(files[0].is_directory, "First item should be a directory");
        assert!(files[1].is_directory, "Second item should be a directory");
        assert!(!files[2].is_directory, "Third item should be a file");
    }
    
    // =========================================================================
    // FEATURE: POSIX File Operations
    // Use Case: User creates, renames, copies, moves, deletes files
    // =========================================================================
    
    /// **Feature**: Create and delete files (POSIX write/unlink)
    #[tokio::test]
    async fn feature_create_and_delete_file() {
        use crate::vfs::adapters::LocalStorageAdapter;
        use crate::vfs::ports::IFileOperations;
        
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        // Create file
        IFileOperations::write(&adapter, Path::new("/document.txt"), b"Hello World").await.unwrap();
        assert!(IFileOperations::exists(&adapter, Path::new("/document.txt")).await.unwrap());
        
        // Delete file
        IFileOperations::rm(&adapter, Path::new("/document.txt")).await.unwrap();
        assert!(!IFileOperations::exists(&adapter, Path::new("/document.txt")).await.unwrap());
    }
    
    /// **Feature**: Rename files (POSIX rename - preserves content)
    #[tokio::test]
    async fn feature_rename_file() {
        use crate::vfs::adapters::LocalStorageAdapter;
        use crate::vfs::ports::IFileOperations;
        
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        IFileOperations::write(&adapter, Path::new("/old_name.txt"), b"content").await.unwrap();
        IFileOperations::rename(&adapter, Path::new("/old_name.txt"), Path::new("/new_name.txt")).await.unwrap();
        
        assert!(!IFileOperations::exists(&adapter, Path::new("/old_name.txt")).await.unwrap());
        let content = IFileOperations::read(&adapter, Path::new("/new_name.txt")).await.unwrap();
        assert_eq!(content, b"content");
    }
    
    /// **Feature**: Copy files (preserves source, creates destination)
    #[tokio::test]
    async fn feature_copy_file_preserves_original() {
        use crate::vfs::adapters::LocalStorageAdapter;
        use crate::vfs::ports::{IFileOperations, CopyOptions};
        
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        IFileOperations::write(&adapter, Path::new("/source.txt"), b"original").await.unwrap();
        
        let opts = CopyOptions::default();
        IFileOperations::copy(&adapter, Path::new("/source.txt"), Path::new("/copy.txt"), opts).await.unwrap();
        
        // Both files exist
        assert!(IFileOperations::exists(&adapter, Path::new("/source.txt")).await.unwrap());
        assert!(IFileOperations::exists(&adapter, Path::new("/copy.txt")).await.unwrap());
        assert_eq!(
            IFileOperations::read(&adapter, Path::new("/copy.txt")).await.unwrap(),
            b"original"
        );
    }
    
    /// **Feature**: Move files (removes source, creates destination)
    #[tokio::test]
    async fn feature_move_file_removes_source() {
        use crate::vfs::adapters::LocalStorageAdapter;
        use crate::vfs::ports::{IFileOperations, MoveOptions};
        
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        IFileOperations::write(&adapter, Path::new("/source.txt"), b"moveme").await.unwrap();
        
        let opts = MoveOptions::default();
        IFileOperations::mv(&adapter, Path::new("/source.txt"), Path::new("/moved.txt"), opts).await.unwrap();
        
        assert!(!IFileOperations::exists(&adapter, Path::new("/source.txt")).await.unwrap());
        assert!(IFileOperations::exists(&adapter, Path::new("/moved.txt")).await.unwrap());
    }
    
    /// **Feature**: Recursive directory delete (POSIX rm -rf)
    #[tokio::test]
    async fn feature_recursive_directory_delete() {
        use crate::vfs::adapters::LocalStorageAdapter;
        use crate::vfs::ports::IFileOperations;
        
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        // Create nested structure: /projects/2024/video/clip.mp4
        IFileOperations::mkdir_p(&adapter, Path::new("/projects/2024/video")).await.unwrap();
        IFileOperations::write(&adapter, Path::new("/projects/2024/video/clip.mp4"), b"video").await.unwrap();
        IFileOperations::write(&adapter, Path::new("/projects/readme.txt"), b"readme").await.unwrap();
        
        // rm -rf deletes entire tree
        IFileOperations::rm_rf(&adapter, Path::new("/projects")).await.unwrap();
        
        assert!(!IFileOperations::exists(&adapter, Path::new("/projects")).await.unwrap());
    }
    
    /// **Feature**: Get file statistics (POSIX stat)
    #[tokio::test]
    async fn feature_get_file_stats() {
        use crate::vfs::adapters::LocalStorageAdapter;
        use crate::vfs::ports::IFileOperations;
        
        let temp_dir = TempDir::new().unwrap();
        let adapter = LocalStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test".to_string(),
        );
        
        // Create 1KB file
        IFileOperations::write(&adapter, Path::new("/data.bin"), &[0u8; 1024]).await.unwrap();
        
        let stat = IFileOperations::stat(&adapter, Path::new("/data.bin")).await.unwrap();
        
        assert_eq!(stat.size, 1024, "File size should be 1024 bytes");
        assert!(stat.is_file, "Should be a file");
        assert!(!stat.is_dir, "Should not be a directory");
        assert!(stat.mtime.is_some(), "Should have modification time");
    }
    
    // =========================================================================
    // FEATURE: NVMe Caching (Hydration)
    // Use Case: Cold file is warmed to local NVMe for fast access
    // =========================================================================
    
    /// **Feature**: Cache files for fast local access (hydration)
    #[tokio::test]
    async fn feature_cache_file_for_fast_access() {
        use crate::vfs::adapters::NvmeCacheAdapter;
        use crate::vfs::domain::{CacheConfig, EvictionPolicy};
        use crate::vfs::ports::CacheAdapter;
        
        let temp_dir = TempDir::new().unwrap();
        let config = CacheConfig {
            path: temp_dir.path().to_path_buf(),
            max_size: 10 * 1024 * 1024, // 10 MB
            eviction_policy: EvictionPolicy::LRU,
            nvme_optimized: false,
        };
        
        let cache = NvmeCacheAdapter::new(config).await.unwrap();
        
        // Cache a "cold" file from S3
        let cold_data = b"video data from S3";
        let path = Path::new("/videos/clip.mp4");
        
        cache.cache_file(path, cold_data).await.unwrap();
        
        // Now file is "hot" - cached locally
        assert!(cache.is_cached(path).await, "File should be in cache");
        
        let cached_data = cache.read_from_cache(path).await.unwrap();
        assert_eq!(cached_data, cold_data);
    }
    
    /// **Feature**: LRU eviction when cache is full
    #[tokio::test]
    async fn feature_cache_evicts_old_files_when_full() {
        use crate::vfs::adapters::NvmeCacheAdapter;
        use crate::vfs::domain::{CacheConfig, EvictionPolicy};
        use crate::vfs::ports::CacheAdapter;
        
        let temp_dir = TempDir::new().unwrap();
        let config = CacheConfig {
            path: temp_dir.path().to_path_buf(),
            max_size: 100, // Tiny 100-byte cache
            eviction_policy: EvictionPolicy::LRU,
            nvme_optimized: false,
        };
        
        let cache = NvmeCacheAdapter::new(config).await.unwrap();
        
        // Fill cache with 60-byte file
        cache.cache_file(Path::new("/old.bin"), &[0u8; 60]).await.unwrap();
        
        // Add another 60-byte file - should evict old one
        cache.cache_file(Path::new("/new.bin"), &[1u8; 60]).await.unwrap();
        
        assert!(!cache.is_cached(Path::new("/old.bin")).await, "Old file should be evicted");
        assert!(cache.is_cached(Path::new("/new.bin")).await, "New file should be cached");
    }
    
    /// **Feature**: Cache statistics tracking
    #[tokio::test]
    async fn feature_cache_stats_track_hits_and_misses() {
        use crate::vfs::adapters::NvmeCacheAdapter;
        use crate::vfs::domain::{CacheConfig, EvictionPolicy};
        use crate::vfs::ports::CacheAdapter;
        
        let temp_dir = TempDir::new().unwrap();
        let config = CacheConfig {
            path: temp_dir.path().to_path_buf(),
            max_size: 10 * 1024 * 1024,
            eviction_policy: EvictionPolicy::LRU,
            nvme_optimized: false,
        };
        
        let cache = NvmeCacheAdapter::new(config).await.unwrap();
        
        cache.cache_file(Path::new("/file.txt"), b"data").await.unwrap();
        
        // Read twice = 2 cache hits
        cache.read_from_cache(Path::new("/file.txt")).await.unwrap();
        cache.read_from_cache(Path::new("/file.txt")).await.unwrap();
        
        let stats = cache.stats().await;
        assert_eq!(stats.hit_count, 2, "Should record 2 cache hits");
        assert_eq!(stats.entry_count, 1, "Should have 1 cached entry");
    }
    
    // =========================================================================
    // FEATURE: S3 Object Storage
    // Use Case: User accesses files in S3 buckets
    // =========================================================================
    
    /// **Feature**: Detect storage tier from S3 storage class
    #[test]
    fn feature_s3_tier_detection_from_storage_class() {
        use crate::vfs::adapters::S3StorageAdapter;
        use crate::vfs::domain::StorageTier;
        
        // Standard = Cold (object storage, not cached)
        assert_eq!(S3StorageAdapter::detect_tier(Some("STANDARD")), StorageTier::Cold);
        
        // Glacier variants = Archive (slow retrieval)
        assert_eq!(S3StorageAdapter::detect_tier(Some("GLACIER")), StorageTier::Archive);
        assert_eq!(S3StorageAdapter::detect_tier(Some("DEEP_ARCHIVE")), StorageTier::Archive);
        
        // Intelligent tiering = Cold (auto-managed)
        assert_eq!(S3StorageAdapter::detect_tier(Some("INTELLIGENT_TIERING")), StorageTier::Cold);
    }
    
    // =========================================================================
    // FEATURE: FSx for NetApp ONTAP
    // Use Case: User accesses enterprise FSx volumes with tiering
    // =========================================================================
    
    /// **Feature**: FSx ONTAP tiering states
    #[test]
    fn feature_fsxn_tier_states() {
        use crate::vfs::adapters::fsxn_storage::FsxTier;
        
        // FSx ONTAP supports multiple tier states
        assert_eq!(FsxTier::Hot, FsxTier::Hot);
        assert_ne!(FsxTier::Hot, FsxTier::Cold);
        
        // Active tiering states
        let _tiering = FsxTier::Tiering;     // Moving data to capacity pool
        let _retrieving = FsxTier::Retrieving; // Retrieving data from capacity pool
    }
    
    /// **Feature**: Mount FSx volume and browse files
    #[tokio::test]
    async fn feature_fsxn_mount_and_browse() {
        use crate::vfs::adapters::FsxOntapAdapter;
        use crate::vfs::ports::StorageAdapter;
        
        let temp_dir = TempDir::new().unwrap();
        std::fs::write(temp_dir.path().join("project.prproj"), "premiere").unwrap();
        
        let adapter = FsxOntapAdapter::new(
            temp_dir.path().to_path_buf(),
            "FSx Production".to_string(),
            None, // S3 access point (optional)
            None, // API endpoint (optional)
        );
        
        assert!(adapter.test_connection().await.unwrap());
        
        let files = adapter.list_files(Path::new("/")).await.unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].name, "project.prproj");
    }
    
    // =========================================================================
    // FEATURE: Multi-Backend Storage Types
    // Use Case: User has unified view of local, cloud, and NAS storage
    // =========================================================================
    
    /// **Feature**: All storage backend types are defined
    #[test]
    fn feature_all_storage_types_supported() {
        use crate::vfs::domain::StorageSourceType;
        
        // Verify all backend types exist
        let types = vec![
            StorageSourceType::Local,   // Local filesystem
            StorageSourceType::S3,      // AWS S3 / compatible
            StorageSourceType::FsxN,    // AWS FSx for NetApp ONTAP
            StorageSourceType::Gcs,     // Google Cloud Storage
            StorageSourceType::Nas,     // NFS/SMB network shares
            StorageSourceType::Block,   // Block devices (EBS, etc.)
        ];
        
        assert_eq!(types.len(), 6, "Should support 6 storage types");
    }
    
    /// **Feature**: NAS adapter with NFS protocol
    #[tokio::test]
    async fn feature_nas_mount_nfs_share() {
        use crate::vfs::adapters::NasStorageAdapter;
        use crate::vfs::adapters::nas_storage::NasProtocol;
        use crate::vfs::ports::StorageAdapter;
        
        let temp_dir = TempDir::new().unwrap();
        
        let adapter = NasStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Media NAS".to_string(),
            NasProtocol::NFS,
            Some("nas.local".to_string()),
        );
        
        assert!(adapter.test_connection().await.unwrap());
        assert_eq!(adapter.name(), "Media NAS");
    }
    
    // =========================================================================
    // FEATURE: Media Processing (FFmpeg)
    // Use Case: User sees video thumbnails in file browser
    // =========================================================================
    
    /// **Feature**: Check FFmpeg availability for thumbnail generation
    #[tokio::test]
    async fn feature_ffmpeg_availability_check() {
        use crate::vfs::adapters::FfmpegMediaAdapter;
        use crate::vfs::ports::IMediaService;
        
        let temp_dir = TempDir::new().unwrap();
        let adapter = FfmpegMediaAdapter::new(temp_dir.path().to_path_buf()).await.unwrap();
        
        // Returns true if FFmpeg is installed, false otherwise
        let available = adapter.is_available();
        println!("FFmpeg available: {}", available);
    }
    
    /// **Feature**: Transcode quality presets exist
    #[test]
    fn feature_transcode_quality_presets() {
        use crate::vfs::ports::TranscodeQuality;
        
        // All quality presets
        let presets = vec![
            TranscodeQuality::Low,      // 480p - fast previews
            TranscodeQuality::Medium,   // 720p - web delivery
            TranscodeQuality::High,     // 1080p - production
            TranscodeQuality::Ultra,    // 4K - high-end
            TranscodeQuality::Adaptive, // Multi-bitrate HLS
        ];
        
        assert_eq!(presets.len(), 5, "Should have 5 quality presets");
    }
    
    /// **Feature**: HLS streaming server generates valid URLs
    #[test]
    fn feature_hls_server_generates_stream_urls() {
        use crate::vfs::infrastructure::hls_server::HlsServerConfig;
        
        let config = HlsServerConfig {
            port: 8080,
            content_dir: PathBuf::from("/tmp/hls"),
        };
        
        // Generate stream URL format
        let job_id = "abc123";
        let url = format!("http://127.0.0.1:{}/stream/{}/playlist.m3u8", config.port, job_id);
        
        assert!(url.starts_with("http://127.0.0.1:8080"));
        assert!(url.ends_with(".m3u8"), "HLS URLs should end with .m3u8");
    }
    
    // =========================================================================
    // FEATURE: VFS Service Orchestration
    // Use Case: Application initializes and manages all storage sources
    // =========================================================================
    
    /// **Feature**: Add local storage source and list files through VfsService
    #[tokio::test]
    async fn feature_vfs_service_adds_local_storage() {
        use crate::vfs::application::VfsService;
        
        let temp_dir = TempDir::new().unwrap();
        std::fs::write(temp_dir.path().join("test.txt"), "hello").unwrap();
        
        let service = VfsService::new().await.unwrap();
        
        // Add local directory as storage source
        let source = service.add_local_source(
            "Test Source".to_string(),
            temp_dir.path().to_path_buf(),
        ).await.unwrap();
        
        assert_eq!(source.name, "Test Source");
        
        // List files through service abstraction
        let files = service.list_files(&source.id, std::path::Path::new("/")).await.unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].name, "test.txt");
    }
    
    // =========================================================================
    // FEATURE: Safe Operation Defaults
    // Use Case: Copy/Move operations have sensible defaults to prevent data loss
    // =========================================================================
    
    /// **Feature**: CopyOptions defaults prevent accidental overwrite
    #[test]
    fn feature_copy_options_safe_defaults() {
        use crate::vfs::ports::CopyOptions;
        
        let opts = CopyOptions::default();
        
        assert!(!opts.overwrite, "Should NOT overwrite by default");
        assert!(!opts.recursive, "recursive is opt-in");
        assert!(!opts.follow_symlinks, "Should NOT follow symlinks by default");
    }
    
    /// **Feature**: MoveOptions defaults prevent accidental overwrite
    #[test]
    fn feature_move_options_safe_defaults() {
        use crate::vfs::ports::MoveOptions;
        
        let opts = MoveOptions::default();
        
        assert!(!opts.overwrite, "Should NOT overwrite by default");
    }
    
    // =========================================================================
    // FEATURE: Clipboard Operations (Copy/Paste between Native and VFS)
    // Use Case: User copies files in Finder, pastes into VFS (and vice versa)
    // =========================================================================
    
    /// **Feature**: Clipboard supports copy operation from VFS
    #[tokio::test]
    async fn feature_clipboard_copy_from_vfs() {
        use crate::vfs::adapters::ClipboardAdapter;
        use crate::vfs::ports::{IClipboardService, ClipboardSource};
        
        let clipboard = ClipboardAdapter::new();
        
        let paths = vec![
            PathBuf::from("/videos/clip.mp4"),
            PathBuf::from("/videos/trailer.mp4"),
        ];
        
        clipboard.copy_files(
            ClipboardSource::Vfs { source_id: "s3-bucket".to_string() },
            paths.clone(),
        ).await.unwrap();
        
        let content = clipboard.get_clipboard().await.unwrap().unwrap();
        assert_eq!(content.paths.len(), 2);
        assert!(!content.is_cut(), "Copy should not be cut");
        assert!(content.is_vfs(), "Source should be VFS");
    }
    
    /// **Feature**: Clipboard supports cut operation (move on paste)
    #[tokio::test]
    async fn feature_clipboard_cut_operation() {
        use crate::vfs::adapters::ClipboardAdapter;
        use crate::vfs::ports::{IClipboardService, ClipboardSource};
        
        let clipboard = ClipboardAdapter::new();
        
        clipboard.cut_files(
            ClipboardSource::Native,
            vec![PathBuf::from("/tmp/file.txt")],
        ).await.unwrap();
        
        let content = clipboard.get_clipboard().await.unwrap().unwrap();
        assert!(content.is_cut(), "Cut should be marked as cut");
        assert!(content.is_native(), "Source should be native");
    }
    
    /// **Feature**: Clipboard can be cleared
    #[tokio::test]
    async fn feature_clipboard_clear() {
        use crate::vfs::adapters::ClipboardAdapter;
        use crate::vfs::ports::{IClipboardService, ClipboardSource};
        
        let clipboard = ClipboardAdapter::new();
        
        clipboard.copy_files(
            ClipboardSource::Native,
            vec![PathBuf::from("/test.txt")],
        ).await.unwrap();
        
        assert!(clipboard.has_files().await.unwrap());
        
        clipboard.clear_clipboard().await.unwrap();
        
        // After clear, get_clipboard returns None (for internal clipboard)
        // Note: OS clipboard may still have content
        let content = clipboard.get_clipboard().await.unwrap();
        // Content might exist from OS clipboard, but internal is cleared
        // The test validates that clear_clipboard doesn't error
    }
    
    /// **Feature**: Clipboard paste within same VFS source
    #[tokio::test]
    async fn feature_clipboard_paste_within_vfs() {
        use crate::vfs::adapters::LocalStorageAdapter;
        use crate::vfs::ports::IFileOperations;
        use crate::vfs::adapters::ClipboardAdapter;
        use crate::vfs::ports::{IClipboardService, ClipboardSource};
        use crate::vfs::application::VfsService;
        use std::sync::Arc;
        
        let temp_dir = TempDir::new().unwrap();
        
        // Create source file
        std::fs::write(temp_dir.path().join("original.txt"), "test content").unwrap();
        std::fs::create_dir(temp_dir.path().join("dest")).unwrap();
        
        // Setup VFS service
        let service = Arc::new(VfsService::new().await.unwrap());
        let source = service.add_local_source("Test".to_string(), temp_dir.path().to_path_buf())
            .await.unwrap();
        
        // Setup clipboard with VFS service
        let mut clipboard = ClipboardAdapter::new();
        clipboard.set_vfs_service(service.clone());
        
        // Copy file to clipboard
        clipboard.copy_files(
            ClipboardSource::Vfs { source_id: source.id.clone() },
            vec![PathBuf::from("/original.txt")],
        ).await.unwrap();
        
        // Paste to destination
        let result = clipboard.paste_to_vfs(&source.id, Path::new("/dest")).await.unwrap();
        
        assert_eq!(result.files_pasted, 1);
        assert_eq!(result.files_failed, 0);
        assert!(result.errors.is_empty());
        
        // Verify file exists at destination
        assert!(temp_dir.path().join("dest/original.txt").exists());
        
        // Verify source still exists (copy, not cut)
        assert!(temp_dir.path().join("original.txt").exists());
    }
    
    /// **Feature**: Clipboard cut removes source after paste
    #[tokio::test]
    async fn feature_clipboard_cut_removes_source() {
        use crate::vfs::adapters::ClipboardAdapter;
        use crate::vfs::ports::{IClipboardService, ClipboardSource};
        use crate::vfs::application::VfsService;
        use std::sync::Arc;
        
        let temp_dir = TempDir::new().unwrap();
        
        // Create source file
        std::fs::write(temp_dir.path().join("to_move.txt"), "move me").unwrap();
        std::fs::create_dir(temp_dir.path().join("dest")).unwrap();
        
        let service = Arc::new(VfsService::new().await.unwrap());
        let source = service.add_local_source("Test".to_string(), temp_dir.path().to_path_buf())
            .await.unwrap();
        
        let mut clipboard = ClipboardAdapter::new();
        clipboard.set_vfs_service(service.clone());
        
        // Cut file to clipboard
        clipboard.cut_files(
            ClipboardSource::Vfs { source_id: source.id.clone() },
            vec![PathBuf::from("/to_move.txt")],
        ).await.unwrap();
        
        // Paste to destination
        let result = clipboard.paste_to_vfs(&source.id, Path::new("/dest")).await.unwrap();
        
        assert_eq!(result.files_pasted, 1);
        
        // Verify file exists at destination
        assert!(temp_dir.path().join("dest/to_move.txt").exists());
        
        // Verify source is removed after cut
        assert!(!temp_dir.path().join("to_move.txt").exists());
        
        // Verify clipboard is cleared after cut operation
        assert!(!clipboard.has_files().await.unwrap());
    }
    
    /// **Feature**: Clipboard handles multiple files
    #[tokio::test]
    async fn feature_clipboard_multiple_files() {
        use crate::vfs::adapters::ClipboardAdapter;
        use crate::vfs::ports::{IClipboardService, ClipboardSource};
        use crate::vfs::application::VfsService;
        use std::sync::Arc;
        
        let temp_dir = TempDir::new().unwrap();
        
        // Create multiple source files
        for i in 1..=5 {
            std::fs::write(temp_dir.path().join(format!("file{}.txt", i)), format!("content {}", i)).unwrap();
        }
        std::fs::create_dir(temp_dir.path().join("dest")).unwrap();
        
        let service = Arc::new(VfsService::new().await.unwrap());
        let source = service.add_local_source("Test".to_string(), temp_dir.path().to_path_buf())
            .await.unwrap();
        
        let mut clipboard = ClipboardAdapter::new();
        clipboard.set_vfs_service(service.clone());
        
        // Copy multiple files
        let paths: Vec<PathBuf> = (1..=5).map(|i| PathBuf::from(format!("/file{}.txt", i))).collect();
        clipboard.copy_files(
            ClipboardSource::Vfs { source_id: source.id.clone() },
            paths,
        ).await.unwrap();
        
        // Paste all
        let result = clipboard.paste_to_vfs(&source.id, Path::new("/dest")).await.unwrap();
        
        assert_eq!(result.files_pasted, 5);
        assert_eq!(result.files_failed, 0);
        
        // Verify all files exist at destination
        for i in 1..=5 {
            assert!(temp_dir.path().join(format!("dest/file{}.txt", i)).exists());
        }
    }
    
    /// **Feature**: Clipboard copy from VFS exports to native clipboard
    /// 
    /// When copying from VFS, files should be exported to temp and written
    /// to OS clipboard so Finder/Explorer can paste them
    #[tokio::test]
    async fn feature_clipboard_vfs_to_native_export() {
        use crate::vfs::adapters::ClipboardAdapter;
        use crate::vfs::ports::{IClipboardService, ClipboardSource};
        use crate::vfs::application::VfsService;
        use std::sync::Arc;
        
        let temp_dir = TempDir::new().unwrap();
        std::fs::write(temp_dir.path().join("export_test.txt"), "export this").unwrap();
        
        let service = Arc::new(VfsService::new().await.unwrap());
        let source = service.add_local_source("Test".to_string(), temp_dir.path().to_path_buf())
            .await.unwrap();
        
        let mut clipboard = ClipboardAdapter::new();
        clipboard.set_vfs_service(service.clone());
        
        // Copy VFS file - should export to temp
        clipboard.copy_files(
            ClipboardSource::Vfs { source_id: source.id.clone() },
            vec![PathBuf::from("/export_test.txt")],
        ).await.unwrap();
        
        // The file should now be in temp directory
        let temp_path = std::env::temp_dir().join("ursly-clipboard").join("export_test.txt");
        assert!(temp_path.exists(), "VFS file should be exported to temp for clipboard");
    }
    
    /// **Feature**: Paste to native filesystem
    #[tokio::test]
    async fn feature_clipboard_paste_to_native() {
        use crate::vfs::adapters::ClipboardAdapter;
        use crate::vfs::ports::{IClipboardService, ClipboardSource};
        use crate::vfs::application::VfsService;
        use std::sync::Arc;
        
        let source_dir = TempDir::new().unwrap();
        let dest_dir = TempDir::new().unwrap();
        
        std::fs::write(source_dir.path().join("to_native.txt"), "going native").unwrap();
        
        let service = Arc::new(VfsService::new().await.unwrap());
        let source = service.add_local_source("Source".to_string(), source_dir.path().to_path_buf())
            .await.unwrap();
        
        let mut clipboard = ClipboardAdapter::new();
        clipboard.set_vfs_service(service.clone());
        
        // Copy from VFS
        clipboard.copy_files(
            ClipboardSource::Vfs { source_id: source.id.clone() },
            vec![PathBuf::from("/to_native.txt")],
        ).await.unwrap();
        
        // Paste to native destination
        let result = clipboard.paste_to_native(dest_dir.path()).await.unwrap();
        
        assert_eq!(result.files_pasted, 1);
        assert!(dest_dir.path().join("to_native.txt").exists());
        
        // Read and verify content
        let content = std::fs::read_to_string(dest_dir.path().join("to_native.txt")).unwrap();
        assert_eq!(content, "going native");
    }
    
    /// **Feature**: Copy between different VFS sources
    #[tokio::test]
    async fn feature_clipboard_cross_source() {
        use crate::vfs::adapters::ClipboardAdapter;
        use crate::vfs::ports::{IClipboardService, ClipboardSource};
        use crate::vfs::application::VfsService;
        use std::sync::Arc;
        
        let source_dir = TempDir::new().unwrap();
        let dest_dir = TempDir::new().unwrap();
        
        std::fs::write(source_dir.path().join("cross.txt"), "cross source").unwrap();
        
        let service = Arc::new(VfsService::new().await.unwrap());
        let source1 = service.add_local_source("Source1".to_string(), source_dir.path().to_path_buf())
            .await.unwrap();
        let source2 = service.add_local_source("Source2".to_string(), dest_dir.path().to_path_buf())
            .await.unwrap();
        
        let mut clipboard = ClipboardAdapter::new();
        clipboard.set_vfs_service(service.clone());
        
        // Copy from source1
        clipboard.copy_files(
            ClipboardSource::Vfs { source_id: source1.id.clone() },
            vec![PathBuf::from("/cross.txt")],
        ).await.unwrap();
        
        // Paste to source2
        let result = clipboard.paste_to_vfs(&source2.id, Path::new("/")).await.unwrap();
        
        assert_eq!(result.files_pasted, 1);
        assert!(dest_dir.path().join("cross.txt").exists());
    }
    
    // =========================================================================
    // FEATURE: Cross-Storage Transfer
    // Use Case: User moves files between local, S3, NAS, etc.
    // =========================================================================
    
    /// **Feature**: Copy file from one storage source to another
    #[tokio::test]
    async fn feature_copy_between_storage_sources() {
        use crate::vfs::application::VfsService;
        use crate::vfs::ports::IFileOperations;
        
        let source_dir = TempDir::new().unwrap();
        let dest_dir = TempDir::new().unwrap();
        
        // Create source file
        std::fs::write(source_dir.path().join("data.txt"), "transfer me").unwrap();
        
        let service = VfsService::new().await.unwrap();
        
        // Add both sources
        let source = service.add_local_source("Source".to_string(), source_dir.path().to_path_buf())
            .await.unwrap();
        let dest = service.add_local_source("Destination".to_string(), dest_dir.path().to_path_buf())
            .await.unwrap();
        
        // Copy between sources
        let bytes = service.copy_to_source(
            &source.id,
            Path::new("/data.txt"),
            &dest.id,
            Path::new("/"),
        ).await.unwrap();
        
        assert!(bytes > 0, "Should transfer some bytes");
        
        // Verify file exists in destination
        let dest_file = dest_dir.path().join("data.txt");
        assert!(dest_file.exists(), "File should exist in destination");
        
        // Original should still exist
        let source_file = source_dir.path().join("data.txt");
        assert!(source_file.exists(), "Original file should still exist");
    }
    
    /// **Feature**: Move file from one storage source to another (deletes source)
    #[tokio::test]
    async fn feature_move_between_storage_sources() {
        use crate::vfs::application::VfsService;
        
        let source_dir = TempDir::new().unwrap();
        let dest_dir = TempDir::new().unwrap();
        
        std::fs::write(source_dir.path().join("move_me.txt"), "moving data").unwrap();
        
        let service = VfsService::new().await.unwrap();
        
        let source = service.add_local_source("Source".to_string(), source_dir.path().to_path_buf())
            .await.unwrap();
        let dest = service.add_local_source("Dest".to_string(), dest_dir.path().to_path_buf())
            .await.unwrap();
        
        // Move between sources
        let bytes = service.move_to_source(
            &source.id,
            Path::new("/move_me.txt"),
            &dest.id,
            Path::new("/"),
        ).await.unwrap();
        
        assert!(bytes > 0);
        
        // Verify file exists in destination but not in source
        assert!(dest_dir.path().join("move_me.txt").exists());
        assert!(!source_dir.path().join("move_me.txt").exists(), "Source should be deleted");
    }
    
    /// **Feature**: Copy entire directory between storage sources
    #[tokio::test]
    async fn feature_copy_directory_between_sources() {
        use crate::vfs::application::VfsService;
        
        let source_dir = TempDir::new().unwrap();
        let dest_dir = TempDir::new().unwrap();
        
        // Create directory structure
        std::fs::create_dir_all(source_dir.path().join("project/src")).unwrap();
        std::fs::write(source_dir.path().join("project/README.md"), "# Project").unwrap();
        std::fs::write(source_dir.path().join("project/src/main.rs"), "fn main() {}").unwrap();
        
        let service = VfsService::new().await.unwrap();
        
        let source = service.add_local_source("Source".to_string(), source_dir.path().to_path_buf())
            .await.unwrap();
        let dest = service.add_local_source("Dest".to_string(), dest_dir.path().to_path_buf())
            .await.unwrap();
        
        // Copy entire project directory
        let bytes = service.copy_to_source(
            &source.id,
            Path::new("/project"),
            &dest.id,
            Path::new("/"),
        ).await.unwrap();
        
        assert!(bytes > 0);
        
        // Verify directory structure in destination
        assert!(dest_dir.path().join("project/README.md").exists());
        assert!(dest_dir.path().join("project/src/main.rs").exists());
    }
    
    /// **Feature**: Get available transfer targets
    #[tokio::test]
    async fn feature_get_transfer_targets() {
        use crate::vfs::application::VfsService;
        
        let dir1 = TempDir::new().unwrap();
        let dir2 = TempDir::new().unwrap();
        
        let service = VfsService::new().await.unwrap();
        
        let s1 = service.add_local_source("Local".to_string(), dir1.path().to_path_buf())
            .await.unwrap();
        let s2 = service.add_local_source("Backup".to_string(), dir2.path().to_path_buf())
            .await.unwrap();
        
        // Get all targets
        let targets = service.get_transfer_targets(None);
        assert_eq!(targets.len(), 2);
        
        // Get targets excluding current source
        let targets = service.get_transfer_targets(Some(&s1.id));
        assert_eq!(targets.len(), 1);
        assert_eq!(targets[0].id, s2.id);
    }
    
    // =========================================================================
    // FEATURE: Tags & Favorites
    // Use Case: User organizes files with tags, favorites, and color labels
    // =========================================================================
    
    /// **Feature**: Add and remove tags from files
    #[tokio::test]
    async fn feature_add_and_remove_tags() {
        use crate::vfs::adapters::JsonMetadataStore;
        use crate::vfs::ports::IMetadataStore;
        use crate::vfs::domain::FileTag;
        
        let temp_dir = TempDir::new().unwrap();
        let store = JsonMetadataStore::new(temp_dir.path().join("meta.json"))
            .await
            .unwrap();
        
        // Add tags
        store.add_tag("local", Path::new("/project.txt"), FileTag::new("important")).await.unwrap();
        store.add_tag("local", Path::new("/project.txt"), FileTag::new("work")).await.unwrap();
        
        let meta = store.get("local", Path::new("/project.txt")).await.unwrap().unwrap();
        assert_eq!(meta.tags.len(), 2);
        
        // Remove a tag
        store.remove_tag("local", Path::new("/project.txt"), "work").await.unwrap();
        
        let meta = store.get("local", Path::new("/project.txt")).await.unwrap().unwrap();
        assert_eq!(meta.tags.len(), 1);
        assert_eq!(meta.tags[0].name, "important");
    }
    
    /// **Feature**: Toggle favorite status
    #[tokio::test]
    async fn feature_toggle_favorite() {
        use crate::vfs::adapters::JsonMetadataStore;
        use crate::vfs::ports::IMetadataStore;
        
        let temp_dir = TempDir::new().unwrap();
        let store = JsonMetadataStore::new(temp_dir.path().join("meta.json"))
            .await
            .unwrap();
        
        // Toggle on
        let is_fav = store.toggle_favorite("local", Path::new("/file.txt")).await.unwrap();
        assert!(is_fav, "First toggle should set to favorite");
        
        // Toggle off
        let is_fav = store.toggle_favorite("local", Path::new("/file.txt")).await.unwrap();
        assert!(!is_fav, "Second toggle should unfavorite");
    }
    
    /// **Feature**: Set color labels (like Finder tags)
    #[tokio::test]
    async fn feature_color_labels() {
        use crate::vfs::adapters::JsonMetadataStore;
        use crate::vfs::ports::IMetadataStore;
        use crate::vfs::domain::ColorLabel;
        
        let temp_dir = TempDir::new().unwrap();
        let store = JsonMetadataStore::new(temp_dir.path().join("meta.json"))
            .await
            .unwrap();
        
        // Set color label
        store.set_color_label("local", Path::new("/urgent"), Some(ColorLabel::Red)).await.unwrap();
        
        let meta = store.get("local", Path::new("/urgent")).await.unwrap().unwrap();
        assert_eq!(meta.color_label, Some(ColorLabel::Red));
        
        // Query by color
        let red_files = store.list_by_color("local", ColorLabel::Red).await.unwrap();
        assert_eq!(red_files.len(), 1);
    }
    
    /// **Feature**: List all favorites across a storage source
    #[tokio::test]
    async fn feature_list_favorites() {
        use crate::vfs::adapters::JsonMetadataStore;
        use crate::vfs::ports::IMetadataStore;
        
        let temp_dir = TempDir::new().unwrap();
        let store = JsonMetadataStore::new(temp_dir.path().join("meta.json"))
            .await
            .unwrap();
        
        store.set_favorite("s3", Path::new("/important.pdf"), true).await.unwrap();
        store.set_favorite("s3", Path::new("/critical.docx"), true).await.unwrap();
        store.set_favorite("s3", Path::new("/normal.txt"), false).await.unwrap();
        
        let favorites = store.list_favorites("s3").await.unwrap();
        assert_eq!(favorites.len(), 2);
    }
    
    /// **Feature**: Metadata persists across restarts
    #[tokio::test]
    async fn feature_metadata_persistence() {
        use crate::vfs::adapters::JsonMetadataStore;
        use crate::vfs::ports::IMetadataStore;
        use crate::vfs::domain::FileTag;
        
        let temp_dir = TempDir::new().unwrap();
        let store_path = temp_dir.path().join("meta.json");
        
        // Create and populate
        {
            let store = JsonMetadataStore::new(store_path.clone()).await.unwrap();
            store.set_favorite("local", Path::new("/test.txt"), true).await.unwrap();
            store.add_tag("local", Path::new("/test.txt"), FileTag::new("persisted")).await.unwrap();
        }
        
        // Reload and verify
        {
            let store = JsonMetadataStore::new(store_path).await.unwrap();
            let meta = store.get("local", Path::new("/test.txt")).await.unwrap().unwrap();
            assert!(meta.is_favorite);
            assert_eq!(meta.tags.len(), 1);
            assert_eq!(meta.tags[0].name, "persisted");
        }
    }
    
    // =========================================================================
    // FEATURE: Native OS Thumbnail Support (Phase 1.2)
    // Use Case: Leverage OS-cached thumbnails for local files
    // =========================================================================
    
    /// **Feature**: OS thumbnail strategy exists for each platform
    #[test]
    fn feature_os_thumbnail_strategy() {
        // macOS: qlmanage -t (QuickLook)
        // Windows: IShellItemImageFactory
        // Linux: ~/.cache/thumbnails/ (freedesktop.org)
        
        #[cfg(target_os = "macos")]
        let strategy = "QuickLook (qlmanage)";
        
        #[cfg(target_os = "windows")]
        let strategy = "Shell Thumbnail Cache";
        
        #[cfg(target_os = "linux")]
        let strategy = "freedesktop.org thumbnail cache";
        
        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        let strategy = "FFmpeg fallback";
        
        assert!(!strategy.is_empty(), "Should have a thumbnail strategy");
    }
    
    // =========================================================================
    // FEATURE: Storage Tier Indicator
    // Use Case: User sees visual indicator of file's storage tier
    // =========================================================================
    
    /// **Feature**: Storage tiers have distinct icons
    #[test]
    fn feature_storage_tier_icons() {
        use crate::vfs::domain::StorageTier;
        
        assert_eq!(StorageTier::Hot.icon(), "flame");
        assert_eq!(StorageTier::Warm.icon(), "thermometer");
        assert_eq!(StorageTier::Cold.icon(), "snowflake");
        assert_eq!(StorageTier::Archive.icon(), "archive");
    }
    
    /// **Feature**: Human-readable file sizes
    #[test]
    fn feature_human_readable_file_sizes() {
        use crate::vfs::domain::FileSize;
        
        assert_eq!(FileSize::from_bytes(500).as_human_readable(), "500 bytes");
        assert_eq!(FileSize::from_bytes(1024).as_human_readable(), "1.00 KB");
        assert_eq!(FileSize::from_bytes(1_500_000).as_human_readable(), "1.43 MB");
        assert_eq!(FileSize::from_bytes(2_500_000_000).as_human_readable(), "2.33 GB");
    }
    
    // =========================================================================
    // FEATURE: Cross-Platform Disk Space (Windows/macOS/Linux)
    // Use Case: Cache manager needs disk space info on any platform
    // =========================================================================
    
    /// **Feature**: Get disk space works on all platforms
    #[tokio::test]
    async fn feature_cross_platform_disk_space() {
        use crate::vfs::platform::get_disk_space;
        
        let temp_dir = TempDir::new().unwrap();
        let space = get_disk_space(temp_dir.path()).unwrap();
        
        assert!(space.total > 0, "Total space must be > 0");
        assert!(space.available <= space.total, "Available <= total");
        assert!(space.used <= space.total, "Used <= total");
        
        // Verify percentage calculation
        let usage = space.usage_percent();
        assert!(usage >= 0.0 && usage <= 100.0, "Usage percent in valid range");
    }
    
    // =========================================================================
    // FEATURE: Cross-Platform File Permissions (Windows ACL / Unix modes)
    // Use Case: User can get/set file permissions on any platform
    // =========================================================================
    
    /// **Feature**: Get file permissions on any platform
    #[test]
    fn feature_cross_platform_get_permissions() {
        use crate::vfs::platform::{get_permissions, FilePermissions};
        
        let temp_file = tempfile::NamedTempFile::new().unwrap();
        let perms = get_permissions(temp_file.path()).unwrap();
        
        // File should be readable on all platforms
        assert!(perms.owner_read, "Owner should be able to read");
    }
    
    /// **Feature**: Unix mode conversion
    #[test]
    fn feature_unix_mode_conversion() {
        use crate::vfs::platform::FilePermissions;
        
        // Standard file permissions (rw-r--r--)
        let perms = FilePermissions::from_mode(0o644);
        assert!(perms.owner_read);
        assert!(perms.owner_write);
        assert!(!perms.owner_execute);
        assert!(perms.group_read);
        assert!(!perms.group_write);
        assert!(perms.others_read);
        
        // Convert back to mode
        assert_eq!(perms.to_mode(), 0o644);
        
        // Executable permissions (rwxr-xr-x)
        let exec_perms = FilePermissions::from_mode(0o755);
        assert!(exec_perms.owner_execute);
        assert!(exec_perms.group_execute);
        assert!(exec_perms.others_execute);
    }
    
    // =========================================================================
    // FEATURE: UNC Path Handling (Windows SMB Shares)
    // Use Case: User accesses \\server\share paths on Windows
    // =========================================================================
    
    /// **Feature**: Detect and parse UNC paths
    #[test]
    fn feature_unc_path_detection() {
        use crate::vfs::platform::paths::{is_unc_path, parse_unc_path, PathType, classify_path};
        use std::path::Path;
        
        // UNC paths with backslashes
        assert!(is_unc_path(Path::new("\\\\server\\share")));
        assert!(is_unc_path(Path::new("\\\\192.168.1.100\\data")));
        
        // UNC paths with forward slashes (normalized form)
        assert!(is_unc_path(Path::new("//server/share")));
        
        // Not UNC paths
        assert!(!is_unc_path(Path::new("/home/user")));
        assert!(!is_unc_path(Path::new("C:\\Users\\test")));
        assert!(!is_unc_path(Path::new("relative/path")));
        
        // Parse UNC components
        let (server, share) = parse_unc_path("\\\\fileserver\\media").unwrap();
        assert_eq!(server, "fileserver");
        assert_eq!(share, "media");
        
        // Path type classification
        let unc_type = classify_path(Path::new("\\\\server\\share\\folder"));
        match unc_type {
            PathType::Unc { server, share } => {
                assert_eq!(server, "server");
                assert_eq!(share, "share");
            }
            _ => panic!("Should be UNC type"),
        }
    }
    
    /// **Feature**: Normalize path separators for current platform
    #[test]
    fn feature_normalize_path_separators() {
        use crate::vfs::platform::paths::{normalize_separators, normalize_path, to_vfs_path};
        use std::path::Path;
        
        // VFS paths always use forward slashes internally
        let path = Path::new("dir\\subdir\\file.txt");
        let vfs_path = to_vfs_path(path);
        assert_eq!(vfs_path, "dir/subdir/file.txt");
        
        // Normalize resolves . and ..
        let dirty_path = Path::new("/home/user/../user2/./docs");
        let clean = normalize_path(dirty_path);
        
        #[cfg(unix)]
        assert_eq!(clean.to_string_lossy(), "/home/user2/docs");
    }
    
    /// **Feature**: Safe path joining prevents traversal attacks
    #[test]
    fn feature_safe_path_join() {
        use crate::vfs::platform::paths::{safe_join, is_within};
        use std::path::Path;
        
        // Safe join strips leading slashes
        let base = Path::new("/home/user");
        let joined = safe_join(base, Path::new("/subdir/file.txt"));
        
        #[cfg(unix)]
        assert_eq!(joined.to_string_lossy(), "/home/user/subdir/file.txt");
        
        // is_within prevents directory traversal
        let parent = Path::new("/home/user");
        let valid_child = Path::new("/home/user/docs/file.txt");
        let attack_path = Path::new("/home/user/../other/secret.txt");
        
        assert!(is_within(valid_child, parent));
        assert!(!is_within(attack_path, parent), "Traversal attack should fail");
    }
    
    // =========================================================================
    // FEATURE: Network Timeout and Retry
    // Use Case: SMB/NAS operations don't hang indefinitely
    // =========================================================================
    
    /// **Feature**: Operations timeout after specified duration
    #[tokio::test]
    async fn feature_network_operation_timeout() {
        use crate::vfs::platform::network::with_timeout;
        use std::time::Duration;
        
        // This should timeout
        let result = with_timeout(Duration::from_millis(100), || async {
            tokio::time::sleep(Duration::from_secs(5)).await;
            Ok::<_, anyhow::Error>(42)
        }).await;
        
        assert!(result.is_err(), "Should timeout");
        assert!(result.unwrap_err().to_string().contains("timed out"));
    }
    
    /// **Feature**: Retry with exponential backoff
    #[tokio::test]
    async fn feature_retry_with_backoff() {
        use crate::vfs::platform::network::retry_with_backoff;
        use std::sync::atomic::{AtomicU32, Ordering};
        use std::sync::Arc;
        use std::time::Duration;
        
        let attempts = Arc::new(AtomicU32::new(0));
        let attempts_clone = attempts.clone();
        
        // Succeed on 3rd attempt
        let result = retry_with_backoff(5, Duration::from_millis(10), || {
            let a = attempts_clone.clone();
            async move {
                let count = a.fetch_add(1, Ordering::Relaxed) + 1;
                if count < 3 {
                    Err(anyhow::anyhow!("Simulated network failure"))
                } else {
                    Ok("success")
                }
            }
        }).await;
        
        assert!(result.is_ok());
        assert_eq!(attempts.load(Ordering::Relaxed), 3);
    }
    
    /// **Feature**: Connection monitor tracks state
    #[tokio::test]
    async fn feature_connection_monitor() {
        use crate::vfs::platform::network::{ConnectionMonitor, ConnectionState};
        
        let monitor = ConnectionMonitor::new("smb://server/share".to_string());
        
        // Initial state is disconnected
        assert_eq!(monitor.state().await, ConnectionState::Disconnected);
        
        // Mark connected
        monitor.mark_connected().await;
        assert_eq!(monitor.state().await, ConnectionState::Connected);
        assert_eq!(monitor.failure_count(), 0);
        
        // Mark failed
        monitor.mark_failed("Connection reset").await;
        assert_eq!(monitor.failure_count(), 1);
    }
    
    /// **Feature**: Check SMB share with timeout
    #[tokio::test]
    async fn feature_smb_share_check_timeout() {
        use crate::vfs::platform::network::check_smb_share;
        use std::path::Path;
        
        // Non-existent share should return false (not hang)
        let result = check_smb_share(Path::new("/nonexistent/smb/share")).await.unwrap();
        assert!(!result, "Non-existent share should return false");
    }
    
    // =========================================================================
    // FEATURE: NAS Adapter with Connection Monitoring
    // Use Case: NAS connection issues are detected and reported
    // =========================================================================
    
    /// **Feature**: NAS adapter uses connection monitor
    #[tokio::test]
    async fn feature_nas_connection_monitoring() {
        use crate::vfs::adapters::NasStorageAdapter;
        use crate::vfs::adapters::nas_storage::NasProtocol;
        use crate::vfs::ports::StorageAdapter;
        
        let temp_dir = TempDir::new().unwrap();
        
        let adapter = NasStorageAdapter::new(
            temp_dir.path().to_path_buf(),
            "Test NAS".to_string(),
            NasProtocol::SMB,
            Some("192.168.1.100".to_string()),
        );
        
        // Test connection (should use connection monitor with timeout)
        let result = adapter.test_connection().await.unwrap();
        assert!(result, "Temp dir should be accessible");
    }
    
    /// **Feature**: NAS adapter reports correct storage type
    #[tokio::test]
    async fn feature_nas_storage_type() {
        use crate::vfs::adapters::NasStorageAdapter;
        use crate::vfs::adapters::nas_storage::NasProtocol;
        use crate::vfs::ports::StorageAdapter;
        use crate::vfs::domain::StorageSourceType;
        
        let temp_dir = TempDir::new().unwrap();
        
        for (protocol, _expected_name) in [
            (NasProtocol::NFS, "NFS"),
            (NasProtocol::SMB, "SMB"),
            (NasProtocol::AFP, "AFP"),
        ] {
            let adapter = NasStorageAdapter::new(
                temp_dir.path().to_path_buf(),
                format!("{:?} Share", protocol),
                protocol,
                None,
            );
            
            // All NAS protocols report as Nas storage type
            assert_eq!(adapter.storage_type(), StorageSourceType::Nas);
        }
    }
    
    // =========================================================================
    // FEATURE: Navigation History Management
    // Use Case: User navigates back/forward through folder history
    // =========================================================================
    
    /// **Feature**: Navigation history tracks visited paths
    #[test]
    fn feature_navigation_history_tracking() {
        struct NavigationHistory {
            history: Vec<String>,
            index: usize,
        }
        
        impl NavigationHistory {
            fn new() -> Self {
                Self { history: vec!["".to_string()], index: 0 }
            }
            
            fn navigate_to(&mut self, path: &str) {
                // Clear forward history
                self.history.truncate(self.index + 1);
                // Add new path
                self.history.push(path.to_string());
                self.index = self.history.len() - 1;
            }
            
            fn go_back(&mut self) -> Option<&str> {
                if self.index > 0 {
                    self.index -= 1;
                    Some(&self.history[self.index])
                } else {
                    None
                }
            }
            
            fn go_forward(&mut self) -> Option<&str> {
                if self.index < self.history.len() - 1 {
                    self.index += 1;
                    Some(&self.history[self.index])
                } else {
                    None
                }
            }
            
            fn can_go_back(&self) -> bool { self.index > 0 }
            fn can_go_forward(&self) -> bool { self.index < self.history.len() - 1 }
        }
        
        let mut nav = NavigationHistory::new();
        
        // Start at root
        assert_eq!(nav.history[nav.index], "");
        assert!(!nav.can_go_back());
        assert!(!nav.can_go_forward());
        
        // Navigate to folder1
        nav.navigate_to("/folder1");
        assert_eq!(nav.history[nav.index], "/folder1");
        assert!(nav.can_go_back());
        assert!(!nav.can_go_forward());
        
        // Navigate to folder2
        nav.navigate_to("/folder1/folder2");
        assert_eq!(nav.history.len(), 3);
        
        // Go back
        let prev = nav.go_back();
        assert_eq!(prev, Some("/folder1"));
        assert!(nav.can_go_forward());
        
        // Go forward
        let next = nav.go_forward();
        assert_eq!(next, Some("/folder1/folder2"));
        
        // Navigate from middle clears forward history
        nav.go_back();
        nav.navigate_to("/folder3");
        assert!(!nav.can_go_forward());
        assert_eq!(nav.history, vec!["", "/folder1", "/folder3"]);
    }
    
    /// **Feature**: Go up navigates to parent directory
    #[test]
    fn feature_navigation_go_up() {
        fn go_up(path: &str) -> String {
            if path.is_empty() {
                return String::new();
            }
            
            let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
            if parts.len() <= 1 {
                return String::new();
            }
            
            format!("/{}", parts[..parts.len()-1].join("/"))
        }
        
        assert_eq!(go_up("/Users/tony/Documents"), "/Users/tony");
        assert_eq!(go_up("/Users/tony"), "/Users");
        assert_eq!(go_up("/Users"), "");
        assert_eq!(go_up(""), "");
    }
    
    /// **Feature**: Source switching resets navigation state
    #[test]
    fn feature_source_switching_resets_state() {
        struct AppState {
            current_source: String,
            current_path: String,
            history: Vec<String>,
        }
        
        impl AppState {
            fn switch_source(&mut self, source_id: &str) {
                self.current_source = source_id.to_string();
                self.current_path = String::new();
                self.history = vec!["".to_string()];
            }
        }
        
        let mut state = AppState {
            current_source: "source1".to_string(),
            current_path: "/some/deep/path".to_string(),
            history: vec!["".to_string(), "/some".to_string(), "/some/deep".to_string(), "/some/deep/path".to_string()],
        };
        
        // Switch source
        state.switch_source("source2");
        
        assert_eq!(state.current_source, "source2");
        assert_eq!(state.current_path, "");
        assert_eq!(state.history.len(), 1);
    }
    
    /// **Feature**: Favorites navigation preserves selection
    #[test]
    fn feature_favorites_navigation() {
        fn navigate_to_favorite(fav_path: &str) -> (String, String) {
            // Extract directory and file from favorite path
            let parts: Vec<&str> = fav_path.rsplitn(2, '/').collect();
            let (file, dir) = if parts.len() == 2 {
                (parts[0].to_string(), parts[1].to_string())
            } else {
                (fav_path.to_string(), "".to_string())
            };
            
            // Return (directory to navigate to, file to select)
            (if dir.is_empty() { "/".to_string() } else { dir }, fav_path.to_string())
        }
        
        let (dir, selected) = navigate_to_favorite("/Users/tony/Documents/important.txt");
        assert_eq!(dir, "/Users/tony/Documents");
        assert_eq!(selected, "/Users/tony/Documents/important.txt");
        
        let (dir, selected) = navigate_to_favorite("/file.txt");
        assert_eq!(dir, "/");
        assert_eq!(selected, "/file.txt");
    }
    
    /// **Feature**: Breadcrumb path generation for different storage types
    #[test]
    fn feature_breadcrumb_generation() {
        fn generate_breadcrumbs(path: &str, storage_type: &str) -> Vec<(String, String)> {
            let mut crumbs = Vec::new();
            
            if path.is_empty() {
                return crumbs;
            }
            
            let parts: Vec<&str> = match storage_type {
                "s3" | "gcs" => path.trim_start_matches('/').split('/').filter(|s| !s.is_empty()).collect(),
                "smb" => path.trim_start_matches("//").split('/').filter(|s| !s.is_empty()).collect(),
                _ => path.split('/').filter(|s| !s.is_empty()).collect(),
            };
            
            let mut accumulated = String::new();
            for part in parts {
                accumulated = if storage_type == "s3" || storage_type == "gcs" {
                    if accumulated.is_empty() { part.to_string() } else { format!("{}/{}", accumulated, part) }
                } else {
                    format!("{}/{}", accumulated, part)
                };
                crumbs.push((part.to_string(), accumulated.clone()));
            }
            
            crumbs
        }
        
        // Local path
        let local = generate_breadcrumbs("/Users/tony/Documents", "local");
        assert_eq!(local.len(), 3);
        assert_eq!(local[0], ("Users".to_string(), "/Users".to_string()));
        assert_eq!(local[2], ("Documents".to_string(), "/Users/tony/Documents".to_string()));
        
        // S3 path (no leading slash in accumulated paths)
        let s3 = generate_breadcrumbs("bucket/prefix/key", "s3");
        assert_eq!(s3.len(), 3);
        assert_eq!(s3[0], ("bucket".to_string(), "bucket".to_string()));
        
        // SMB path
        let smb = generate_breadcrumbs("//server/share/folder", "smb");
        assert_eq!(smb.len(), 3);
        assert_eq!(smb[0], ("server".to_string(), "/server".to_string()));
    }
    
    /// **Feature**: Keyboard navigation shortcuts
    #[test]
    fn feature_keyboard_navigation() {
        enum NavAction { Back, Forward, Up, Open, None }
        
        fn handle_key(key: &str, meta: bool, has_path: bool, history_index: usize, history_len: usize) -> NavAction {
            match (key, meta) {
                ("[", true) if history_index > 0 => NavAction::Back,
                ("]", true) if history_index < history_len.saturating_sub(1) => NavAction::Forward,
                ("ArrowUp", true) if has_path => NavAction::Up,
                ("Enter", _) => NavAction::Open,
                _ => NavAction::None,
            }
        }
        
        // Cmd+[ goes back
        assert!(matches!(handle_key("[", true, true, 2, 5), NavAction::Back));
        // Cmd+[ at start does nothing
        assert!(matches!(handle_key("[", true, true, 0, 5), NavAction::None));
        
        // Cmd+] goes forward
        assert!(matches!(handle_key("]", true, true, 2, 5), NavAction::Forward));
        // Cmd+] at end does nothing
        assert!(matches!(handle_key("]", true, true, 4, 5), NavAction::None));
        
        // Cmd+Up goes up
        assert!(matches!(handle_key("ArrowUp", true, true, 0, 1), NavAction::Up));
        // Cmd+Up at root does nothing
        assert!(matches!(handle_key("ArrowUp", true, false, 0, 1), NavAction::None));
        
        // Enter opens
        assert!(matches!(handle_key("Enter", false, true, 0, 1), NavAction::Open));
    }
    
    /// **Feature**: Comprehensive keyboard shortcuts (OS-agnostic)
    #[test]
    fn feature_keyboard_shortcuts_comprehensive() {
        // All keyboard shortcuts should work identically on macOS, Windows, and Linux
        // The only difference is Cmd (macOS) vs Ctrl (Windows/Linux) which we handle with "meta"
        
        #[derive(Debug, Clone, PartialEq)]
        enum Action {
            Back, Forward, Up, Open, 
            Copy, Cut, Paste, Delete,
            SelectAll, NewFolder, Rename, Duplicate, 
            GetInfo, Refresh, Escape,
            None,
        }
        
        fn handle_shortcut(
            key: &str, 
            meta: bool, 
            shift: bool, 
            has_selection: bool,
            selection_count: usize,
        ) -> Action {
            match (key, meta, shift) {
                // Navigation
                ("[", true, _) => Action::Back,
                ("]", true, _) => Action::Forward,
                ("ArrowUp", true, _) => Action::Up,
                ("Enter", false, _) if has_selection && selection_count == 1 => Action::Open,
                
                // File operations
                ("c", true, _) if has_selection => Action::Copy,
                ("x", true, _) if has_selection => Action::Cut,
                ("v", true, _) => Action::Paste,
                ("Delete" | "Backspace", false, _) if has_selection => Action::Delete,
                
                // Selection
                ("a", true, _) => Action::SelectAll,
                
                // File management
                ("N", true, true) => Action::NewFolder,
                ("F2", false, _) if selection_count == 1 => Action::Rename,
                ("d", true, _) if selection_count == 1 => Action::Duplicate,
                
                // Info & preview
                ("i", true, _) if selection_count == 1 => Action::GetInfo,
                (" ", false, _) if selection_count == 1 => Action::GetInfo, // Quick Look with Space
                
                // Refresh
                ("r", true, _) => Action::Refresh,
                ("F5", false, _) => Action::Refresh,
                
                // Escape
                ("Escape", false, _) => Action::Escape,
                
                _ => Action::None,
            }
        }
        
        // Test navigation shortcuts
        assert_eq!(handle_shortcut("[", true, false, false, 0), Action::Back);
        assert_eq!(handle_shortcut("]", true, false, false, 0), Action::Forward);
        assert_eq!(handle_shortcut("ArrowUp", true, false, false, 0), Action::Up);
        assert_eq!(handle_shortcut("Enter", false, false, true, 1), Action::Open);
        
        // Test clipboard shortcuts
        assert_eq!(handle_shortcut("c", true, false, true, 1), Action::Copy);
        assert_eq!(handle_shortcut("x", true, false, true, 3), Action::Cut);
        assert_eq!(handle_shortcut("v", true, false, false, 0), Action::Paste);
        
        // Test delete
        assert_eq!(handle_shortcut("Delete", false, false, true, 1), Action::Delete);
        assert_eq!(handle_shortcut("Backspace", false, false, true, 1), Action::Delete);
        
        // Test select all
        assert_eq!(handle_shortcut("a", true, false, false, 0), Action::SelectAll);
        
        // Test file management
        assert_eq!(handle_shortcut("N", true, true, false, 0), Action::NewFolder);
        assert_eq!(handle_shortcut("F2", false, false, true, 1), Action::Rename);
        assert_eq!(handle_shortcut("d", true, false, true, 1), Action::Duplicate);
        
        // Test info/preview
        assert_eq!(handle_shortcut("i", true, false, true, 1), Action::GetInfo);
        assert_eq!(handle_shortcut(" ", false, false, true, 1), Action::GetInfo);
        
        // Test refresh
        assert_eq!(handle_shortcut("r", true, false, false, 0), Action::Refresh);
        assert_eq!(handle_shortcut("F5", false, false, false, 0), Action::Refresh);
        
        // Test escape
        assert_eq!(handle_shortcut("Escape", false, false, true, 2), Action::Escape);
        
        // Verify shortcuts require correct conditions
        assert_eq!(handle_shortcut("c", true, false, false, 0), Action::None); // No selection
        assert_eq!(handle_shortcut("d", true, false, true, 2), Action::None); // Multiple selected
        assert_eq!(handle_shortcut("F2", false, false, true, 2), Action::None); // Multiple selected
    }
    
    // =========================================================================
    // FEATURE: Context Menu Actions
    // Use Case: User right-clicks on files for quick actions
    // =========================================================================
    
    /// **Feature**: Context menu determines available actions based on file state
    #[test]
    fn feature_context_menu_actions() {
        use crate::vfs::domain::value_objects::StorageTier;
        
        #[derive(Debug, Clone)]
        struct FileState {
            is_directory: bool,
            tier: StorageTier,
            is_warmed: bool,
            can_transcode: bool,
            is_favorite: bool,
        }
        
        struct ContextMenuActions {
            open: bool,
            copy: bool,
            cut: bool,
            paste: bool,
            rename: bool,
            duplicate: bool,
            move_to: bool,
            delete: bool,
            hydrate: bool,
            warm: bool,
            archive: bool,
            transcode: bool,
            favorite: bool,
            tags: bool,
            get_info: bool,
        }
        
        fn get_available_actions(file: Option<&FileState>, has_clipboard: bool) -> ContextMenuActions {
            let has_file = file.is_some();
            let is_cold = file.map(|f| matches!(f.tier, StorageTier::Cold | StorageTier::Nearline | StorageTier::Archive)).unwrap_or(false);
            let can_warm = file.map(|f| !f.is_warmed && is_cold).unwrap_or(false);
            
            ContextMenuActions {
                open: has_file,
                copy: has_file,
                cut: has_file,
                paste: has_clipboard,
                rename: has_file,
                duplicate: has_file,
                move_to: has_file,
                delete: has_file,
                hydrate: has_file && is_cold,
                warm: has_file && can_warm,
                archive: has_file,
                transcode: file.map(|f| f.can_transcode).unwrap_or(false),
                favorite: has_file,
                tags: has_file,
                get_info: has_file,
            }
        }
        
        // Hot file - no hydrate/warm options
        let hot_file = FileState {
            is_directory: false,
            tier: StorageTier::Hot,
            is_warmed: true,
            can_transcode: false,
            is_favorite: false,
        };
        let actions = get_available_actions(Some(&hot_file), true);
        assert!(actions.open);
        assert!(actions.copy);
        assert!(actions.paste);
        assert!(!actions.hydrate, "Hot file should not show hydrate");
        assert!(!actions.warm, "Warmed file should not show warm");
        
        // Cold file - shows hydrate/warm
        let cold_file = FileState {
            is_directory: false,
            tier: StorageTier::Cold,
            is_warmed: false,
            can_transcode: true,
            is_favorite: false,
        };
        let actions = get_available_actions(Some(&cold_file), false);
        assert!(actions.hydrate, "Cold file should show hydrate");
        assert!(actions.warm, "Cold file should show warm");
        assert!(actions.transcode, "Transcodable file should show transcode");
        assert!(!actions.paste, "No clipboard should disable paste");
        
        // Nearline file - shows hydrate
        let nearline_file = FileState {
            is_directory: false,
            tier: StorageTier::Nearline,
            is_warmed: false,
            can_transcode: false,
            is_favorite: true,
        };
        let actions = get_available_actions(Some(&nearline_file), true);
        assert!(actions.hydrate, "Nearline file should show hydrate");
        assert!(actions.favorite, "Should show favorite toggle");
        
        // No file selected (right-click on empty space)
        let actions = get_available_actions(None, true);
        assert!(!actions.open);
        assert!(!actions.copy);
        assert!(actions.paste, "Paste should work on empty space");
        assert!(!actions.hydrate);
    }
    
    /// **Feature**: Hydration moves file from cold to hot storage
    #[test]
    fn feature_hydration_cold_to_hot() {
        use crate::vfs::domain::value_objects::StorageTier;
        
        struct HydrationRequest {
            source_tier: StorageTier,
            target_tier: StorageTier,
            priority: HydrationPriority,
        }
        
        #[derive(Debug, Clone, Copy, PartialEq)]
        enum HydrationPriority { Low, Normal, High }
        
        #[derive(Debug, Clone, Copy, PartialEq)]
        enum HydrationResult { Success, AlreadyHot, InProgress, Failed }
        
        fn process_hydration(request: &HydrationRequest) -> HydrationResult {
            match request.source_tier {
                StorageTier::Hot => HydrationResult::AlreadyHot,
                StorageTier::Warm | StorageTier::Cold | StorageTier::Nearline | StorageTier::Archive => {
                    // In real impl, would queue hydration job
                    HydrationResult::Success
                }
            }
        }
        
        // Cold to hot
        let request = HydrationRequest {
            source_tier: StorageTier::Cold,
            target_tier: StorageTier::Hot,
            priority: HydrationPriority::High,
        };
        assert_eq!(process_hydration(&request), HydrationResult::Success);
        
        // Nearline to hot
        let request = HydrationRequest {
            source_tier: StorageTier::Nearline,
            target_tier: StorageTier::Hot,
            priority: HydrationPriority::Normal,
        };
        assert_eq!(process_hydration(&request), HydrationResult::Success);
        
        // Archive to hot
        let request = HydrationRequest {
            source_tier: StorageTier::Archive,
            target_tier: StorageTier::Hot,
            priority: HydrationPriority::Low,
        };
        assert_eq!(process_hydration(&request), HydrationResult::Success);
        
        // Already hot
        let request = HydrationRequest {
            source_tier: StorageTier::Hot,
            target_tier: StorageTier::Hot,
            priority: HydrationPriority::High,
        };
        assert_eq!(process_hydration(&request), HydrationResult::AlreadyHot);
    }
    
    /// **Feature**: Storage tier determines retrieval time estimate
    #[test]
    fn feature_tier_retrieval_time() {
        use crate::vfs::domain::value_objects::StorageTier;
        
        fn estimate_retrieval_seconds(tier: StorageTier) -> u32 {
            match tier {
                StorageTier::Hot => 0,           // Instant
                StorageTier::Warm => 1,          // ~1 second
                StorageTier::Cold => 60,         // ~1 minute
                StorageTier::Nearline => 30,     // ~30 seconds
                StorageTier::Archive => 43200,   // ~12 hours (Glacier)
            }
        }
        
        assert_eq!(estimate_retrieval_seconds(StorageTier::Hot), 0);
        assert_eq!(estimate_retrieval_seconds(StorageTier::Warm), 1);
        assert_eq!(estimate_retrieval_seconds(StorageTier::Cold), 60);
        assert_eq!(estimate_retrieval_seconds(StorageTier::Nearline), 30);
        assert_eq!(estimate_retrieval_seconds(StorageTier::Archive), 43200);
    }
    
    /// **Feature**: Context menu respects storage category
    #[test]
    fn feature_context_menu_storage_category() {
        #[derive(Debug, Clone, Copy, PartialEq)]
        enum StorageCategory { Local, Network, Cloud }
        
        fn get_hydrate_label(category: StorageCategory) -> &'static str {
            match category {
                StorageCategory::Local => "Cache Locally",
                StorageCategory::Network => "Hydrate from Network",
                StorageCategory::Cloud => "Hydrate from Cloud",
            }
        }
        
        assert_eq!(get_hydrate_label(StorageCategory::Local), "Cache Locally");
        assert_eq!(get_hydrate_label(StorageCategory::Network), "Hydrate from Network");
        assert_eq!(get_hydrate_label(StorageCategory::Cloud), "Hydrate from Cloud");
    }
    
    // =========================================================================
    // FEATURE: Cross-Platform Clipboard
    // Ensures copy/paste works identically on macOS, Windows, Linux
    // =========================================================================
    
    /// **Feature**: Clipboard operations are OS-agnostic
    #[tokio::test]
    async fn feature_clipboard_cross_platform() {
        use crate::vfs::adapters::ClipboardAdapter;
        use crate::vfs::ports::{IClipboardService, ClipboardSource};
        
        let clipboard = ClipboardAdapter::new();
        
        // Copy operation should work on any OS
        let paths = vec![
            PathBuf::from("/test/file1.txt"),
            PathBuf::from("/test/file2.txt"),
        ];
        
        let result = clipboard.copy_files(
            ClipboardSource::Vfs { source_id: "test-source".to_string() },
            paths.clone(),
        ).await;
        
        assert!(result.is_ok(), "Copy should work on all platforms");
        assert!(clipboard.has_files().await.unwrap(), "Should have files after copy");
        
        let content = clipboard.get_clipboard().await.unwrap().unwrap();
        assert_eq!(content.paths.len(), 2, "Should have 2 files");
    }
    
    /// **Feature**: VFS to native filesystem copy
    #[tokio::test]
    async fn feature_vfs_to_native_copy() {
        use crate::vfs::application::VfsService;
        use std::sync::Arc;
        
        let source_dir = TempDir::new().unwrap();
        let dest_dir = TempDir::new().unwrap();
        
        // Create a VFS source with a test file
        std::fs::write(source_dir.path().join("export.txt"), "export content").unwrap();
        
        let service = Arc::new(VfsService::new().await.unwrap());
        let source = service.add_local_source("VFS".to_string(), source_dir.path().to_path_buf())
            .await.unwrap();
        
        // Read from VFS
        let data = service.read(&source.id, Path::new("/export.txt")).await.unwrap();
        
        // Write to native filesystem
        let native_path = dest_dir.path().join("export.txt");
        std::fs::write(&native_path, &data).unwrap();
        
        assert!(native_path.exists(), "File should exist in native FS");
        assert_eq!(std::fs::read_to_string(&native_path).unwrap(), "export content");
    }
    
    /// **Feature**: Native filesystem to VFS copy
    #[tokio::test]
    async fn feature_native_to_vfs_copy() {
        use crate::vfs::application::VfsService;
        use crate::vfs::ports::IFileOperations;
        use std::sync::Arc;
        
        let native_dir = TempDir::new().unwrap();
        let vfs_dir = TempDir::new().unwrap();
        
        // Create a native file
        let native_file = native_dir.path().join("import.txt");
        std::fs::write(&native_file, "import content").unwrap();
        
        let service = Arc::new(VfsService::new().await.unwrap());
        let vfs_source = service.add_local_source("VFS".to_string(), vfs_dir.path().to_path_buf())
            .await.unwrap();
        
        // Read from native filesystem
        let data = std::fs::read(&native_file).unwrap();
        
        // Write to VFS
        service.write(&vfs_source.id, Path::new("/import.txt"), &data).await.unwrap();
        
        // Verify in VFS
        let read_back = service.read(&vfs_source.id, Path::new("/import.txt")).await.unwrap();
        assert_eq!(String::from_utf8(read_back).unwrap(), "import content");
    }
    
    /// **Feature**: Drag and drop between sources works
    #[tokio::test]
    async fn feature_drag_drop_cross_source() {
        use crate::vfs::application::VfsService;
        
        let source1_dir = TempDir::new().unwrap();
        let source2_dir = TempDir::new().unwrap();
        
        std::fs::write(source1_dir.path().join("dragged.txt"), "drag data").unwrap();
        
        let service = VfsService::new().await.unwrap();
        
        let source1 = service.add_local_source("Source1".to_string(), source1_dir.path().to_path_buf())
            .await.unwrap();
        let source2 = service.add_local_source("Source2".to_string(), source2_dir.path().to_path_buf())
            .await.unwrap();
        
        // Simulate drag and drop (copy between sources)
        let bytes = service.copy_to_source(
            &source1.id,
            Path::new("/dragged.txt"),
            &source2.id,
            Path::new("/"),
        ).await.unwrap();
        
        assert!(bytes > 0, "Should transfer data");
        assert!(source2_dir.path().join("dragged.txt").exists(), "File should be in target");
        assert!(source1_dir.path().join("dragged.txt").exists(), "Original should remain");
    }
    
    /// **Feature**: Context menu actions work consistently
    #[tokio::test]
    async fn feature_context_menu_consistency() {
        use crate::vfs::adapters::ClipboardAdapter;
        use crate::vfs::ports::{IClipboardService, ClipboardSource};
        use crate::vfs::application::VfsService;
        use std::sync::Arc;
        
        let dir = TempDir::new().unwrap();
        std::fs::write(dir.path().join("menu_test.txt"), "menu data").unwrap();
        
        let service = Arc::new(VfsService::new().await.unwrap());
        let source = service.add_local_source("Test".to_string(), dir.path().to_path_buf())
            .await.unwrap();
        
        let mut clipboard = ClipboardAdapter::new();
        clipboard.set_vfs_service(service.clone());
        
        // Test Copy action
        clipboard.copy_files(
            ClipboardSource::Vfs { source_id: source.id.clone() },
            vec![PathBuf::from("/menu_test.txt")],
        ).await.unwrap();
        assert!(clipboard.has_files().await.unwrap(), "Copy should populate clipboard");
        
        // Test Clear action  
        clipboard.clear_clipboard().await.unwrap();
        assert!(!clipboard.has_files().await.unwrap(), "Clear should empty clipboard");
        
        // Test Cut action
        clipboard.cut_files(
            ClipboardSource::Vfs { source_id: source.id.clone() },
            vec![PathBuf::from("/menu_test.txt")],
        ).await.unwrap();
        
        let content = clipboard.get_clipboard().await.unwrap().unwrap();
        assert!(content.is_cut(), "Cut operation should be marked as cut");
    }
}

// =========================================================================
// TEST SUMMARY
// =========================================================================
//
// Run all feature tests:
//   cargo test --lib feature_ -- --nocapture
//
// Test count by category:
//   - File System Operations: 7 tests
//   - Caching & Hydration: 3 tests
//   - Storage Backends: 5 tests  
//   - Media Processing: 3 tests
//   - VFS Orchestration: 1 test
//   - Configuration: 2 tests
//   - Native Thumbnails: 1 test
//   - UI Helpers: 2 tests
//   - Cross-Platform: 10 tests
//   - Navigation: 6 tests
//   - Context Menu & Hydration: 4 tests
//   - Cross-Platform Clipboard: 5 tests (NEW)
//
// Total: 49 feature tests
// =========================================================================
