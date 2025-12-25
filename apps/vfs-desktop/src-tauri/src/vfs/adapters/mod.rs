//! Adapters Layer - Concrete implementations of ports
//!
//! Adapters implement the port interfaces and handle the actual
//! communication with external systems (S3, local filesystem, etc.)

pub mod local_storage;
pub mod s3_storage;
pub mod nvme_cache;
pub mod tauri_event_bus;
pub mod ffmpeg_media;
pub mod fsxn_storage;
pub mod gcs_storage;
pub mod nas_storage;
pub mod clipboard;
pub mod metadata_store;
pub mod native_thumbnail;

pub use local_storage::LocalStorageAdapter;
pub use s3_storage::S3StorageAdapter;
pub use nvme_cache::NvmeCacheAdapter;
pub use tauri_event_bus::TauriEventBus;
pub use ffmpeg_media::FfmpegMediaAdapter;
pub use fsxn_storage::FsxOntapAdapter;
pub use gcs_storage::GcsStorageAdapter;
pub use nas_storage::{NasStorageAdapter, NasProtocol};
pub use clipboard::ClipboardAdapter;
pub use metadata_store::JsonMetadataStore;
pub use native_thumbnail::{NativeThumbnailAdapter, ThumbnailType};

