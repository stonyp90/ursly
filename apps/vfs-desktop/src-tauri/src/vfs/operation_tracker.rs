//! Operation Tracker - Tracks uploads, downloads, deletes, and other file operations
//!
//! Provides a unified system for tracking file operations with:
//! - Progress tracking
//! - Operation history
//! - State persistence

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use parking_lot::RwLock;
use tracing::{error, info};
use uuid::Uuid;
use chrono::Utc;

/// Operation type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OperationType {
    Upload,
    Download,
    Delete,
    Move,
    Copy,
}

/// Operation status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OperationStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Canceled,
}

/// Operation record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Operation {
    /// Unique operation ID
    pub operation_id: String,
    /// Operation type
    pub operation_type: OperationType,
    /// Source ID
    pub source_id: String,
    /// Source path (for downloads/deletes)
    pub source_path: String,
    /// Destination path (for uploads/downloads)
    pub destination_path: Option<String>,
    /// File size (if applicable)
    pub file_size: Option<u64>,
    /// Bytes processed
    pub bytes_processed: u64,
    /// Operation status
    pub status: OperationStatus,
    /// Error message if failed
    pub error: Option<String>,
    /// Timestamp when operation was created
    #[serde(with = "chrono::serde::ts_seconds_option")]
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Timestamp when operation was completed
    #[serde(with = "chrono::serde::ts_seconds_option")]
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Timestamp of last update
    #[serde(with = "chrono::serde::ts_seconds_option")]
    pub last_updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Operation tracker manager
pub struct OperationTracker {
    /// Active and completed operations
    operations: Arc<RwLock<HashMap<String, Operation>>>,
    /// State file path
    state_file: PathBuf,
    /// Maximum number of completed operations to keep in history
    max_history: usize,
}

impl OperationTracker {
    pub fn new(state_dir: &Path, max_history: usize) -> Result<Self> {
        std::fs::create_dir_all(state_dir)
            .context("Failed to create operation tracker state directory")?;
        
        let state_file = state_dir.join("operations.json");
        
        let tracker = Self {
            operations: Arc::new(RwLock::new(HashMap::new())),
            state_file,
            max_history,
        };
        
        // Load existing operations
        tracker.load_state()?;
        
        Ok(tracker)
    }

    /// Load operations from disk
    fn load_state(&self) -> Result<()> {
        if !self.state_file.exists() {
            return Ok(());
        }

        let data = std::fs::read_to_string(&self.state_file)
            .context("Failed to read operations state file")?;
        
        let operations: HashMap<String, Operation> = serde_json::from_str(&data)
            .context("Failed to parse operations state file")?;
        
        let mut ops = self.operations.write();
        *ops = operations;
        
        info!("Loaded {} operations from state file", ops.len());
        Ok(())
    }

    /// Save operations to disk
    fn save_state(&self) -> Result<()> {
        let ops = self.operations.read();
        let data = serde_json::to_string_pretty(&*ops)
            .context("Failed to serialize operations")?;
        
        std::fs::write(&self.state_file, data)
            .context("Failed to write operations state file")?;
        
        Ok(())
    }

    /// Create a new operation
    pub fn create_operation(
        &self,
        operation_type: OperationType,
        source_id: String,
        source_path: String,
        destination_path: Option<String>,
        file_size: Option<u64>,
    ) -> String {
        let operation_id = Uuid::new_v4().to_string();
        let now = Some(Utc::now());
        
        let operation = Operation {
            operation_id: operation_id.clone(),
            operation_type,
            source_id,
            source_path,
            destination_path,
            file_size,
            bytes_processed: 0,
            status: OperationStatus::Pending,
            error: None,
            created_at: now,
            completed_at: None,
            last_updated_at: now,
        };
        
        {
            let mut ops = self.operations.write();
            ops.insert(operation_id.clone(), operation);
        }
        
        if let Err(e) = self.save_state() {
            error!("Failed to save operation state: {}", e);
        }
        
        info!("Created operation: {}", operation_id);
        operation_id
    }

    /// Update operation progress
    pub fn update_progress(
        &self,
        operation_id: &str,
        bytes_processed: u64,
    ) -> Result<()> {
        {
            let mut ops = self.operations.write();
            if let Some(op) = ops.get_mut(operation_id) {
                op.bytes_processed = bytes_processed;
                op.status = OperationStatus::InProgress;
                op.last_updated_at = Some(Utc::now());
            }
        }
        
        self.save_state()?;
        Ok(())
    }

    /// Mark operation as completed
    pub fn complete_operation(
        &self,
        operation_id: &str,
    ) -> Result<()> {
        {
            let mut ops = self.operations.write();
            if let Some(op) = ops.get_mut(operation_id) {
                op.status = OperationStatus::Completed;
                op.completed_at = Some(Utc::now());
                op.last_updated_at = Some(Utc::now());
                
                // If file_size was not set, set it to bytes_processed
                if op.file_size.is_none() {
                    op.file_size = Some(op.bytes_processed);
                }
            }
        }
        
        self.cleanup_old_operations();
        self.save_state()?;
        Ok(())
    }

    /// Mark operation as failed
    pub fn fail_operation(
        &self,
        operation_id: &str,
        error: String,
    ) -> Result<()> {
        {
            let mut ops = self.operations.write();
            if let Some(op) = ops.get_mut(operation_id) {
                op.status = OperationStatus::Failed;
                op.error = Some(error);
                op.completed_at = Some(Utc::now());
                op.last_updated_at = Some(Utc::now());
            }
        }
        
        self.cleanup_old_operations();
        self.save_state()?;
        Ok(())
    }

    /// Cancel operation
    pub fn cancel_operation(
        &self,
        operation_id: &str,
    ) -> Result<()> {
        {
            let mut ops = self.operations.write();
            if let Some(op) = ops.get_mut(operation_id) {
                op.status = OperationStatus::Canceled;
                op.completed_at = Some(Utc::now());
                op.last_updated_at = Some(Utc::now());
            }
        }
        
        self.cleanup_old_operations();
        self.save_state()?;
        Ok(())
    }

    /// Get all operations
    pub fn get_all_operations(&self) -> Vec<Operation> {
        let ops = self.operations.read();
        ops.values().cloned().collect()
    }

    /// Get operations by type
    pub fn get_operations_by_type(&self, operation_type: &OperationType) -> Vec<Operation> {
        let ops = self.operations.read();
        ops.values()
            .filter(|op| op.operation_type == *operation_type)
            .cloned()
            .collect()
    }

    /// Get active operations
    pub fn get_active_operations(&self) -> Vec<Operation> {
        let ops = self.operations.read();
        ops.values()
            .filter(|op| {
                op.status == OperationStatus::Pending || op.status == OperationStatus::InProgress
            })
            .cloned()
            .collect()
    }

    /// Get completed operations (limited by max_history)
    pub fn get_completed_operations(&self) -> Vec<Operation> {
        let ops = self.operations.read();
        let mut completed: Vec<Operation> = ops.values()
            .filter(|op| {
                op.status == OperationStatus::Completed || op.status == OperationStatus::Failed
            })
            .cloned()
            .collect();
        
        // Sort by completed_at (most recent first)
        completed.sort_by(|a, b| {
            let a_time = a.completed_at.or(a.last_updated_at).or(a.created_at);
            let b_time = b.completed_at.or(b.last_updated_at).or(b.created_at);
            b_time.cmp(&a_time)
        });
        
        // Limit to max_history
        completed.truncate(self.max_history);
        completed
    }

    /// Cleanup old completed operations beyond max_history
    fn cleanup_old_operations(&self) {
        let mut ops = self.operations.write();
        
        let mut completed: Vec<(String, chrono::DateTime<chrono::Utc>)> = ops.iter()
            .filter_map(|(id, op)| {
                if op.status == OperationStatus::Completed || op.status == OperationStatus::Failed {
                    op.completed_at.or(op.last_updated_at).or(op.created_at)
                        .map(|time| (id.clone(), time))
                } else {
                    None
                }
            })
            .collect();
        
        completed.sort_by(|a, b| b.1.cmp(&a.1));
        
        // Remove operations beyond max_history
        if completed.len() > self.max_history {
            for (id, _) in completed.iter().skip(self.max_history) {
                ops.remove(id);
            }
        }
    }
}
