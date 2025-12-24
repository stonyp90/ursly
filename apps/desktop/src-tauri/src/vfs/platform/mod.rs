//! Cross-platform utilities for VFS
//!
//! This module provides platform-specific implementations for:
//! - Disk space calculation (Windows/Unix)
//! - File permissions and ACLs (Windows/Unix)
//! - Path utilities (UNC paths, separators)
//! - Network timeout wrappers

pub mod disk;
pub mod permissions;
pub mod paths;
pub mod network;

pub use disk::*;
pub use permissions::*;
pub use paths::*;
pub use network::*;



