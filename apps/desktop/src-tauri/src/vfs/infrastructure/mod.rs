//! Infrastructure Layer - External framework integrations
//!
//! This layer contains implementations that depend on external frameworks,
//! databases, file systems, and other infrastructure concerns.

pub mod state;
pub mod hls_server;

pub use state::VfsState;
pub use hls_server::{HlsServer, HlsServerConfig};

