//! Ports Layer - Abstract interfaces defining contracts
//!
//! Ports define the boundaries of the application. They are interfaces
//! that the application core defines and expects adapters to implement.

pub mod storage;
pub mod cache;
pub mod event_bus;
pub mod file_operations;
pub mod media;
pub mod clipboard;
pub mod metadata;
pub mod cross_storage;
pub mod sync;

pub use storage::StorageAdapter;
pub use cache::{CacheAdapter, CacheStats};
pub use event_bus::EventBus;
pub use file_operations::{
    IFileOperations, FileOperationsExt, FileEntry, FileStat,
    CopyOptions, MoveOptions, DeleteOptions,
};
pub use media::{
    IMediaService, MediaInfo, ThumbnailData, StreamFormat,
    TranscodeQuality, TranscodeJob, TranscodeStatus,
};
pub use clipboard::{
    IClipboardService, ClipboardContent, ClipboardOperation,
    ClipboardSource, PasteResult,
};
pub use metadata::{
    IMetadataStore, FileMetadata,
};
pub use cross_storage::{
    ICrossStorageService, CrossStorageOptions, CrossStorageResult,
    CrossStorageProgress, TransferEstimate,
};
pub use sync::{
    IStorageSyncService, SyncRequest, SyncResult, SyncProgress,
    SyncDirection, SyncMode, SyncPriority, SyncTarget, SyncEstimate,
    TieringRequest, NvmeCacheStats, SyncOperation,
};

