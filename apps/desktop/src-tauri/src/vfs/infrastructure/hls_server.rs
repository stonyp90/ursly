//! HLS Streaming Server
//!
//! A lightweight local HTTP server for serving HLS streams.
//! Uses Axum for the web framework.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use parking_lot::RwLock;
use tracing::{info, error};

/// HLS Server configuration
#[derive(Debug, Clone)]
pub struct HlsServerConfig {
    /// Port to listen on (0 for auto-assign)
    pub port: u16,
    
    /// Directory containing HLS output files
    pub content_dir: PathBuf,
}

impl Default for HlsServerConfig {
    fn default() -> Self {
        Self {
            port: 0, // Auto-assign port
            content_dir: std::env::temp_dir().join("ursly_hls"),
        }
    }
}

/// HLS Streaming Server
pub struct HlsServer {
    config: HlsServerConfig,
    port: Arc<RwLock<Option<u16>>>,
    running: Arc<RwLock<bool>>,
}

impl HlsServer {
    /// Create a new HLS server
    pub fn new(config: HlsServerConfig) -> Self {
        Self {
            config,
            port: Arc::new(RwLock::new(None)),
            running: Arc::new(RwLock::new(false)),
        }
    }
    
    /// Get the port the server is running on
    pub fn port(&self) -> Option<u16> {
        *self.port.read()
    }
    
    /// Check if server is running
    pub fn is_running(&self) -> bool {
        *self.running.read()
    }
    
    /// Get the base URL for streams
    pub fn base_url(&self) -> Option<String> {
        self.port().map(|p| format!("http://localhost:{}", p))
    }
    
    /// Get a stream URL for a job
    pub fn stream_url(&self, job_id: &str) -> Option<String> {
        self.base_url().map(|url| format!("{}/stream/{}/playlist.m3u8", url, job_id))
    }
    
    /// Start the server (non-blocking version without Axum)
    /// This version uses a simple approach without requiring the full Axum stack
    #[cfg(not(feature = "media"))]
    pub async fn start(&self) -> anyhow::Result<()> {
        info!("HLS server not available (media feature not enabled)");
        Ok(())
    }
    
    /// Start the server with Axum
    #[cfg(feature = "media")]
    pub async fn start(&self) -> anyhow::Result<()> {
        use axum::{
            Router,
            routing::get,
            extract::Path,
            response::IntoResponse,
            http::{header, StatusCode},
        };
        use tower_http::cors::{CorsLayer, Any};
        use std::net::TcpListener;
        
        // Ensure content directory exists
        tokio::fs::create_dir_all(&self.config.content_dir).await?;
        
        let content_dir = self.config.content_dir.clone();
        let port_lock = self.port.clone();
        let running_lock = self.running.clone();
        
        // Create router
        let app = Router::new()
            .route("/stream/:job_id/*path", get(move |Path((job_id, path)): Path<(String, String)>| {
                let content_dir = content_dir.clone();
                async move {
                    let file_path = content_dir.join(&job_id).join(&path);
                    
                    match tokio::fs::read(&file_path).await {
                        Ok(data) => {
                            // Determine content type
                            let content_type = if path.ends_with(".m3u8") {
                                "application/vnd.apple.mpegurl"
                            } else if path.ends_with(".ts") {
                                "video/mp2t"
                            } else {
                                "application/octet-stream"
                            };
                            
                            (
                                StatusCode::OK,
                                [(header::CONTENT_TYPE, content_type)],
                                data,
                            ).into_response()
                        }
                        Err(_) => (StatusCode::NOT_FOUND, "File not found").into_response(),
                    }
                }
            }))
            .route("/health", get(|| async { "OK" }))
            .layer(
                CorsLayer::new()
                    .allow_origin(Any)
                    .allow_methods(Any)
                    .allow_headers(Any)
            );
        
        // Bind to address
        let addr = SocketAddr::from(([127, 0, 0, 1], self.config.port));
        let listener = tokio::net::TcpListener::bind(addr).await?;
        let actual_port = listener.local_addr()?.port();
        
        *port_lock.write() = Some(actual_port);
        *running_lock.write() = true;
        
        info!("HLS server started on http://localhost:{}", actual_port);
        
        // Run server
        tokio::spawn(async move {
            if let Err(e) = axum::serve(listener, app).await {
                error!("HLS server error: {}", e);
            }
            *running_lock.write() = false;
        });
        
        Ok(())
    }
    
    /// Stop the server
    pub fn stop(&self) {
        *self.running.write() = false;
        *self.port.write() = None;
        info!("HLS server stopped");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_hls_server_config_default() {
        let config = HlsServerConfig::default();
        assert_eq!(config.port, 0);
    }
    
    #[test]
    fn test_hls_server_stream_url() {
        let server = HlsServer::new(HlsServerConfig::default());
        // Before starting, port should be None
        assert!(server.port().is_none());
        assert!(server.stream_url("test-job").is_none());
    }
}



