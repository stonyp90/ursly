//! Network utilities for VFS
//!
//! Provides timeout wrappers, connection monitoring, and reconnection logic
//! for network storage (SMB, NFS, S3, etc.)

use anyhow::{Context, Result};
use std::future::Future;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Default timeout for network operations (30 seconds)
pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

/// Default connection check interval (5 seconds)
pub const DEFAULT_CHECK_INTERVAL: Duration = Duration::from_secs(5);

/// Maximum reconnection attempts
pub const MAX_RECONNECT_ATTEMPTS: u32 = 3;

/// Reconnection delay (exponential backoff base)
pub const RECONNECT_DELAY_BASE: Duration = Duration::from_secs(1);

/// Network connection state
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ConnectionState {
    Connected,
    Disconnected,
    Connecting,
    Error,
}

/// Network operation result with timing
#[derive(Debug)]
pub struct TimedResult<T> {
    pub result: T,
    pub duration: Duration,
}

/// Run an async operation with timeout
pub async fn with_timeout<T, F, Fut>(timeout: Duration, operation: F) -> Result<TimedResult<T>>
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<T>>,
{
    let start = Instant::now();
    
    match tokio::time::timeout(timeout, operation()).await {
        Ok(result) => {
            let duration = start.elapsed();
            result.map(|r| TimedResult { result: r, duration })
        }
        Err(_) => {
            Err(anyhow::anyhow!(
                "Operation timed out after {:?}",
                timeout
            ))
        }
    }
}

/// Run an async operation with default timeout
pub async fn with_default_timeout<T, F, Fut>(operation: F) -> Result<TimedResult<T>>
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<T>>,
{
    with_timeout(DEFAULT_TIMEOUT, operation).await
}

/// Connection monitor for network storage
pub struct ConnectionMonitor {
    /// Current connection state
    state: Arc<RwLock<ConnectionState>>,
    
    /// Is connection check in progress
    checking: AtomicBool,
    
    /// Last successful connection time (Unix timestamp)
    last_connected: AtomicU64,
    
    /// Consecutive failure count
    failure_count: AtomicU64,
    
    /// Mount point or endpoint being monitored
    endpoint: String,
}

impl ConnectionMonitor {
    /// Create a new connection monitor
    pub fn new(endpoint: String) -> Self {
        Self {
            state: Arc::new(RwLock::new(ConnectionState::Disconnected)),
            checking: AtomicBool::new(false),
            last_connected: AtomicU64::new(0),
            failure_count: AtomicU64::new(0),
            endpoint,
        }
    }
    
    /// Get current connection state
    pub async fn state(&self) -> ConnectionState {
        *self.state.read().await
    }
    
    /// Check if connected
    pub async fn is_connected(&self) -> bool {
        *self.state.read().await == ConnectionState::Connected
    }
    
    /// Get failure count
    pub fn failure_count(&self) -> u64 {
        self.failure_count.load(Ordering::Relaxed)
    }
    
    /// Mark connection as successful
    pub async fn mark_connected(&self) {
        let mut state = self.state.write().await;
        *state = ConnectionState::Connected;
        self.failure_count.store(0, Ordering::Relaxed);
        self.last_connected.store(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            Ordering::Relaxed
        );
        debug!("Connection to {} marked as connected", self.endpoint);
    }
    
    /// Mark connection as failed
    pub async fn mark_failed(&self, error: &str) {
        let mut state = self.state.write().await;
        let failures = self.failure_count.fetch_add(1, Ordering::Relaxed) + 1;
        
        if failures >= MAX_RECONNECT_ATTEMPTS as u64 {
            *state = ConnectionState::Error;
            error!(
                "Connection to {} failed {} times: {}",
                self.endpoint, failures, error
            );
        } else {
            *state = ConnectionState::Disconnected;
            warn!(
                "Connection to {} failed (attempt {}): {}",
                self.endpoint, failures, error
            );
        }
    }
    
    /// Check connection to a path-based mount
    pub async fn check_path_connection(&self, mount_path: &Path) -> bool {
        if self.checking.swap(true, Ordering::Relaxed) {
            // Already checking
            return self.is_connected().await;
        }
        
        {
            let mut state = self.state.write().await;
            *state = ConnectionState::Connecting;
        }
        
        let result = with_timeout(Duration::from_secs(5), || async {
            // Try to list directory to verify connection
            match tokio::fs::read_dir(mount_path).await {
                Ok(_) => Ok(true),
                Err(e) => Err(anyhow::anyhow!("Connection check failed: {}", e)),
            }
        }).await;
        
        self.checking.store(false, Ordering::Relaxed);
        
        match result {
            Ok(_) => {
                self.mark_connected().await;
                true
            }
            Err(e) => {
                self.mark_failed(&e.to_string()).await;
                false
            }
        }
    }
}

/// Retry an operation with exponential backoff
pub async fn retry_with_backoff<T, F, Fut>(
    max_attempts: u32,
    base_delay: Duration,
    operation: F,
) -> Result<T>
where
    F: Fn() -> Fut,
    Fut: Future<Output = Result<T>>,
{
    let mut attempt = 0;
    let mut last_error = None;
    
    while attempt < max_attempts {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                attempt += 1;
                last_error = Some(e);
                
                if attempt < max_attempts {
                    let delay = base_delay * 2u32.pow(attempt - 1);
                    warn!(
                        "Operation failed (attempt {}/{}), retrying in {:?}",
                        attempt, max_attempts, delay
                    );
                    tokio::time::sleep(delay).await;
                }
            }
        }
    }
    
    Err(last_error.unwrap_or_else(|| anyhow::anyhow!("Operation failed after {} attempts", max_attempts)))
}

/// Wrap a network operation with timeout and retry
pub async fn network_operation<T, F, Fut>(
    operation: F,
    timeout: Duration,
    max_retries: u32,
) -> Result<T>
where
    F: Fn() -> Fut + Clone,
    Fut: Future<Output = Result<T>>,
{
    retry_with_backoff(max_retries, RECONNECT_DELAY_BASE, || async {
        let result = with_timeout(timeout, || operation()).await?;
        Ok(result.result)
    }).await
}

// =============================================================================
// SMB-specific utilities
// =============================================================================

/// Check if an SMB share is accessible
pub async fn check_smb_share(path: &Path) -> Result<bool> {
    match with_timeout(Duration::from_secs(10), || async {
        match tokio::fs::read_dir(path).await {
            Ok(_) => Ok(true),
            Err(e) => {
                debug!("SMB share check failed for {:?}: {}", path, e);
                Ok(false)
            }
        }
    })
    .await
    {
        Ok(timed_result) => Ok(timed_result.result),
        Err(_) => Ok(false), // Timeout means share is not accessible
    }
}

/// Mount an SMB share (Windows)
#[cfg(windows)]
pub async fn mount_smb_share(
    unc_path: &str,
    drive_letter: Option<char>,
    username: Option<&str>,
    password: Option<&str>,
) -> Result<PathBuf> {
    use std::process::Command;
    
    let mut cmd = Command::new("net");
    cmd.arg("use");
    
    if let Some(letter) = drive_letter {
        cmd.arg(format!("{}:", letter));
    } else {
        cmd.arg("*"); // Auto-assign drive letter
    }
    
    cmd.arg(unc_path);
    
    if let Some(pass) = password {
        cmd.arg(pass);
    }
    
    if let Some(user) = username {
        cmd.arg("/user:").arg(user);
    }
    
    let output = tokio::task::spawn_blocking(move || cmd.output())
        .await?
        .context("Failed to run net use command")?;
    
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        // Parse drive letter from output if auto-assigned
        if let Some(letter) = drive_letter {
            Ok(PathBuf::from(format!("{}:\\", letter)))
        } else {
            // Try to extract from output
            info!("SMB mount output: {}", stdout);
            Ok(PathBuf::from(unc_path))
        }
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(anyhow::anyhow!("Failed to mount SMB share: {}", stderr))
    }
}

/// Unmount an SMB share (Windows)
#[cfg(windows)]
pub async fn unmount_smb_share(path: &str) -> Result<()> {
    use std::process::Command;
    
    let path_owned = path.to_string();
    let output = tokio::task::spawn_blocking(move || {
        Command::new("net")
            .args(["use", &path_owned, "/delete", "/y"])
            .output()
    })
    .await?
    .context("Failed to run net use /delete command")?;
    
    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(anyhow::anyhow!("Failed to unmount SMB share: {}", stderr))
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_with_timeout_success() {
        let result = with_timeout(Duration::from_secs(5), || async {
            tokio::time::sleep(Duration::from_millis(100)).await;
            Ok::<_, anyhow::Error>(42)
        }).await;
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap().result, 42);
    }
    
    #[tokio::test]
    async fn test_with_timeout_failure() {
        let result = with_timeout(Duration::from_millis(100), || async {
            tokio::time::sleep(Duration::from_secs(5)).await;
            Ok::<_, anyhow::Error>(42)
        }).await;
        
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("timed out"));
    }
    
    #[tokio::test]
    async fn test_connection_monitor() {
        let monitor = ConnectionMonitor::new("test://localhost".to_string());
        
        assert_eq!(monitor.state().await, ConnectionState::Disconnected);
        
        monitor.mark_connected().await;
        assert_eq!(monitor.state().await, ConnectionState::Connected);
        assert_eq!(monitor.failure_count(), 0);
        
        monitor.mark_failed("test error").await;
        assert_eq!(monitor.failure_count(), 1);
    }
    
    #[tokio::test]
    async fn test_retry_with_backoff_success() {
        let counter = Arc::new(std::sync::atomic::AtomicU32::new(0));
        let counter_clone = counter.clone();
        
        let result = retry_with_backoff(3, Duration::from_millis(10), || {
            let c = counter_clone.clone();
            async move {
                let attempt = c.fetch_add(1, Ordering::Relaxed);
                if attempt < 2 {
                    Err(anyhow::anyhow!("Simulated failure"))
                } else {
                    Ok(42)
                }
            }
        }).await;
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
        assert_eq!(counter.load(Ordering::Relaxed), 3);
    }
    
    #[tokio::test]
    async fn test_check_path_connection() {
        let temp_dir = TempDir::new().unwrap();
        let monitor = ConnectionMonitor::new(temp_dir.path().to_string_lossy().to_string());
        
        let connected = monitor.check_path_connection(temp_dir.path()).await;
        assert!(connected);
        assert_eq!(monitor.state().await, ConnectionState::Connected);
    }
    
    #[tokio::test]
    async fn test_check_path_connection_failure() {
        let monitor = ConnectionMonitor::new("/nonexistent/path".to_string());
        
        let connected = monitor.check_path_connection(Path::new("/nonexistent/path")).await;
        assert!(!connected);
    }
}

