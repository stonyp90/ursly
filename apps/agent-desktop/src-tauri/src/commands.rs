//! Tauri Commands for GPU Metrics
//! 
//! IPC commands that can be called from the frontend.

use crate::gpu::{self, GpuInfo, GpuMetrics, GPU_METRICS};
use crate::system::{self, SystemInfo, SystemMetrics, ProcessInfo};
use serde::{Deserialize, Serialize};
use std::process::{Command, Child};
use std::sync::Mutex;

/// Running model state
static RUNNING_MODEL: once_cell::sync::Lazy<Mutex<Option<RunningModel>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(None));

#[derive(Debug, Serialize)]
pub struct RunningModel {
    pub name: String,
    pub pid: u32,
    pub started_at: u64,
    #[serde(skip)]
    pub process: Option<Child>,
}

/// All metrics combined for dashboard
#[derive(Debug, Serialize)]
pub struct AllMetrics {
    pub gpus: Vec<GpuWithMetrics>,
    pub system: SystemMetrics,
    pub model_processes: Vec<ProcessInfo>,
    pub running_model: Option<ModelStatus>,
}

#[derive(Debug, Serialize)]
pub struct GpuWithMetrics {
    pub info: GpuInfo,
    pub current: GpuMetrics,
    pub history: Vec<GpuMetrics>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModelStatus {
    pub name: String,
    pub running: bool,
    pub started_at: u64,
    pub duration_seconds: u64,
}

/// Get information about all detected GPUs
#[tauri::command]
pub fn get_gpu_info() -> Vec<GpuInfo> {
    gpu::detect_gpus()
}

/// Get current metrics for a specific GPU
#[tauri::command]
pub fn get_gpu_metrics(gpu_id: u32) -> GpuMetrics {
    gpu::get_current_metrics(gpu_id)
}

/// Get system information
#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    system::get_system_info()
}

/// Get all metrics for the dashboard
#[tauri::command]
pub fn get_all_metrics() -> AllMetrics {
    let gpu_infos = gpu::detect_gpus();
    let histories = GPU_METRICS.lock().unwrap();
    
    let gpus: Vec<GpuWithMetrics> = gpu_infos
        .into_iter()
        .map(|info| {
            let current = gpu::get_current_metrics(info.id);
            let history = histories
                .iter()
                .find(|h| h.gpu_id == info.id)
                .map(|h| h.samples.clone())
                .unwrap_or_default();
            
            GpuWithMetrics {
                info,
                current,
                history,
            }
        })
        .collect();

    let system = system::get_system_metrics();
    let model_processes = system::find_model_processes();
    
    let running_model = {
        let model = RUNNING_MODEL.lock().unwrap();
        model.as_ref().map(|m| {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            ModelStatus {
                name: m.name.clone(),
                running: true,
                started_at: m.started_at,
                duration_seconds: now - m.started_at,
            }
        })
    };

    AllMetrics {
        gpus,
        system,
        model_processes,
        running_model,
    }
}

/// Model configuration for starting
#[derive(Debug, Deserialize)]
pub struct ModelConfig {
    pub name: String,
    pub ollama_url: Option<String>,
}

/// Start a model using Ollama
#[tauri::command]
pub async fn start_model(config: ModelConfig) -> Result<ModelStatus, String> {
    let mut running = RUNNING_MODEL.lock().map_err(|e| e.to_string())?;
    
    if running.is_some() {
        return Err("A model is already running".to_string());
    }

    let ollama_url = config.ollama_url.unwrap_or_else(|| "http://localhost:11434".to_string());
    
    // Start ollama run command
    let process = Command::new("ollama")
        .args(["run", &config.name])
        .env("OLLAMA_HOST", &ollama_url)
        .spawn()
        .map_err(|e| format!("Failed to start model: {}", e))?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let pid = process.id();
    
    let model = RunningModel {
        name: config.name.clone(),
        pid,
        started_at: now,
        process: Some(process),
    };

    let status = ModelStatus {
        name: model.name.clone(),
        running: true,
        started_at: model.started_at,
        duration_seconds: 0,
    };

    *running = Some(model);
    
    Ok(status)
}

/// Stop the currently running model
#[tauri::command]
pub async fn stop_model() -> Result<(), String> {
    let mut running = RUNNING_MODEL.lock().map_err(|e| e.to_string())?;
    
    if let Some(mut model) = running.take() {
        if let Some(ref mut process) = model.process {
            let _ = process.kill();
        }
        Ok(())
    } else {
        Err("No model is currently running".to_string())
    }
}

/// Get current model status
#[tauri::command]
pub fn get_model_status() -> Option<ModelStatus> {
    let running = RUNNING_MODEL.lock().ok()?;
    
    running.as_ref().map(|m| {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        ModelStatus {
            name: m.name.clone(),
            running: true,
            started_at: m.started_at,
            duration_seconds: now - m.started_at,
        }
    })
}

