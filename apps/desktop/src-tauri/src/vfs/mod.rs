//! Virtual File System Implementation
//!
//! Clean Architecture structure following Ports & Adapters pattern:
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                      VFS Module                              │
//! ├─────────────────────────────────────────────────────────────┤
//! │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐        │
//! │  │   Domain    │   │    Ports    │   │  Adapters   │        │
//! │  │  entities   │   │  (traits)   │   │ (concrete)  │        │
//! │  │  values     │   │ IStorage    │   │ S3Adapter   │        │
//! │  │  events     │   │ ICache      │   │ LocalAdapter│        │
//! │  └─────────────┘   └─────────────┘   └─────────────┘        │
//! │           │               ▲                 │                │
//! │           └───────────────┼─────────────────┘                │
//! │                           │                                  │
//! │                  ┌────────┴────────┐                         │
//! │                  │   Application   │                         │
//! │                  │   (use cases)   │                         │
//! │                  └─────────────────┘                         │
//! └─────────────────────────────────────────────────────────────┘
//! ```

// Domain Layer - Core business entities and value objects
pub mod domain;

// Ports - Abstract interfaces (traits) defining contracts
pub mod ports;

// Adapters - Concrete implementations of ports
pub mod adapters;

// Application Layer - Use cases and business logic
pub mod application;

// Infrastructure - FUSE filesystem, commands
pub mod infrastructure;

// Platform-specific utilities (cross-platform support)
pub mod platform;

// Re-exports for convenience
pub use domain::*;
pub use ports::StorageAdapter;
pub use application::VfsService;

// Legacy exports (for backward compatibility during refactor)
pub mod commands;
pub mod types;

// Feature tests - one clear test per use case
#[cfg(test)]
mod tests;

// Conditionally include FUSE-dependent modules
#[cfg(feature = "vfs")]
pub mod filesystem;
#[cfg(feature = "vfs")]
pub mod hydration;
#[cfg(feature = "vfs")]
pub mod mount;

#[cfg(feature = "vfs")]
pub use filesystem::UrslyFS;
#[cfg(feature = "vfs")]
pub use hydration::HydratedOperator;
#[cfg(feature = "vfs")]
pub use mount::{mount_virtual_drive, unmount_virtual_drive};
