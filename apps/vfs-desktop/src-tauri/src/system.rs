//! System Metrics Collection Module
//! 
//! Provides CPU, memory, and system information using sysinfo crate.

use serde::{Deserialize, Serialize};
use sysinfo::{System, Networks};
use std::sync::Mutex;
use std::time::Instant;

/// State for calculating rates (bytes per second)
struct IoState {
    last_update: Instant,
    last_net_rx: u64,
    last_net_tx: u64,
    last_disk_read: u64,
    last_disk_write: u64,
    // Calculated rates
    net_rx_rate: u64,
    net_tx_rate: u64,
    disk_read_rate: u64,
    disk_write_rate: u64,
}

impl Default for IoState {
    fn default() -> Self {
        Self {
            last_update: Instant::now(),
            last_net_rx: 0,
            last_net_tx: 0,
            last_disk_read: 0,
            last_disk_write: 0,
            net_rx_rate: 0,
            net_tx_rate: 0,
            disk_read_rate: 0,
            disk_write_rate: 0,
        }
    }
}

static IO_STATE: Mutex<Option<IoState>> = Mutex::new(None);

/// System information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os_name: String,
    pub os_version: String,
    pub kernel_version: String,
    pub hostname: String,
    pub cpu_brand: String,
    pub cpu_cores: usize,
    pub total_memory_mb: u64,
    pub total_swap_mb: u64,
}

/// Real-time system metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub cpu_usage: f32,
    pub per_core_usage: Vec<f32>,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub memory_usage_percent: f32,
    pub swap_used_mb: u64,
    pub swap_total_mb: u64,
    pub disk_read_bytes_sec: u64,
    pub disk_write_bytes_sec: u64,
    pub network_rx_bytes_sec: u64,
    pub network_tx_bytes_sec: u64,
    pub load_average: [f64; 3],
    pub uptime_seconds: u64,
    pub timestamp: u64,
}

/// Process information for running models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f32,
    pub memory_mb: u64,
    pub status: String,
    pub start_time: u64,
}

/// Get system information
pub fn get_system_info() -> SystemInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_cores = sys.cpus().len();
    let cpu_brand = sys
        .cpus()
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "Unknown CPU".to_string());

    SystemInfo {
        os_name: System::name().unwrap_or_else(|| "Unknown".to_string()),
        os_version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        kernel_version: System::kernel_version().unwrap_or_else(|| "Unknown".to_string()),
        hostname: System::host_name().unwrap_or_else(|| "Unknown".to_string()),
        cpu_brand,
        cpu_cores,
        total_memory_mb: sys.total_memory() / (1024 * 1024),
        total_swap_mb: sys.total_swap() / (1024 * 1024),
    }
}

/// Get current system metrics
pub fn get_system_metrics() -> SystemMetrics {
    let mut sys = System::new_all();
    sys.refresh_all();

    // Wait a bit for accurate CPU readings
    std::thread::sleep(std::time::Duration::from_millis(100));
    sys.refresh_cpu_all();

    let cpu_usage = sys.global_cpu_usage();
    let per_core_usage: Vec<f32> = sys.cpus().iter().map(|c| c.cpu_usage()).collect();

    let memory_used = sys.used_memory() / (1024 * 1024);
    let memory_total = sys.total_memory() / (1024 * 1024);
    let memory_usage_percent = if memory_total > 0 {
        (memory_used as f32 / memory_total as f32) * 100.0
    } else {
        0.0
    };

    // Get disk I/O and network I/O rates
    let networks = Networks::new_with_refreshed_list();
    let (disk_read, disk_write, net_rx, net_tx) = calculate_io_rates(&networks);

    let load_avg = System::load_average();

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    SystemMetrics {
        cpu_usage,
        per_core_usage,
        memory_used_mb: memory_used,
        memory_total_mb: memory_total,
        memory_usage_percent,
        swap_used_mb: sys.used_swap() / (1024 * 1024),
        swap_total_mb: sys.total_swap() / (1024 * 1024),
        disk_read_bytes_sec: disk_read,
        disk_write_bytes_sec: disk_write,
        network_rx_bytes_sec: net_rx,
        network_tx_bytes_sec: net_tx,
        load_average: [load_avg.one, load_avg.five, load_avg.fifteen],
        uptime_seconds: System::uptime(),
        timestamp,
    }
}

/// Get network cumulative totals
fn get_network_totals(networks: &Networks) -> (u64, u64) {
    let mut rx = 0u64;
    let mut tx = 0u64;

    for (_, data) in networks.iter() {
        rx += data.received();
        tx += data.transmitted();
    }

    (rx, tx)
}

/// Get disk I/O cumulative totals (platform-specific)
#[cfg(target_os = "macos")]
fn get_disk_totals() -> (u64, u64) {
    use std::process::Command;
    
    // Use iostat on macOS to get disk stats
    if let Ok(output) = Command::new("iostat")
        .args(["-d", "-c", "1"])
        .output()
    {
        if let Ok(stdout) = String::from_utf8(output.stdout) {
            // Parse iostat output - this is approximate
            let lines: Vec<&str> = stdout.lines().collect();
            if lines.len() >= 3 {
                // Parse the KB/t columns (simplified)
                let parts: Vec<&str> = lines.last().unwrap_or(&"").split_whitespace().collect();
                if parts.len() >= 3 {
                    let read_kb = parts.get(1).and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
                    let write_kb = parts.get(2).and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
                    return ((read_kb * 1024.0) as u64, (write_kb * 1024.0) as u64);
                }
            }
        }
    }
    (0, 0)
}

#[cfg(target_os = "linux")]
fn get_disk_totals() -> (u64, u64) {
    use std::fs;
    
    // Read /proc/diskstats
    if let Ok(content) = fs::read_to_string("/proc/diskstats") {
        let mut read_sectors = 0u64;
        let mut write_sectors = 0u64;
        
        for line in content.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 14 {
                // Skip loop and dm- devices
                let name = parts.get(2).unwrap_or(&"");
                if name.starts_with("loop") || name.starts_with("dm-") {
                    continue;
                }
                // Only include real disks (sda, nvme0n1, etc.)
                if name.starts_with("sd") || name.starts_with("nvme") || name.starts_with("vd") {
                    read_sectors += parts.get(5).and_then(|s| s.parse().ok()).unwrap_or(0);
                    write_sectors += parts.get(9).and_then(|s| s.parse().ok()).unwrap_or(0);
                }
            }
        }
        
        // Sector size is typically 512 bytes
        return (read_sectors * 512, write_sectors * 512);
    }
    (0, 0)
}

#[cfg(target_os = "windows")]
fn get_disk_totals() -> (u64, u64) {
    // Windows would need WMI or performance counters
    // For now return 0 - can be implemented later
    (0, 0)
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn get_disk_totals() -> (u64, u64) {
    (0, 0)
}

/// Calculate I/O rates (bytes per second) from cumulative totals
fn calculate_io_rates(networks: &Networks) -> (u64, u64, u64, u64) {
    let mut state_guard = IO_STATE.lock().unwrap();
    
    let (current_net_rx, current_net_tx) = get_network_totals(networks);
    let (current_disk_read, current_disk_write) = get_disk_totals();
    
    let state = state_guard.get_or_insert_with(|| {
        IoState {
            last_update: Instant::now(),
            last_net_rx: current_net_rx,
            last_net_tx: current_net_tx,
            last_disk_read: current_disk_read,
            last_disk_write: current_disk_write,
            net_rx_rate: 0,
            net_tx_rate: 0,
            disk_read_rate: 0,
            disk_write_rate: 0,
        }
    });
    
    let elapsed = state.last_update.elapsed().as_secs_f64();
    
    // Only update if at least 0.5 seconds have passed
    if elapsed >= 0.5 {
        // Calculate rates (handle counter resets gracefully)
        if current_net_rx >= state.last_net_rx {
            state.net_rx_rate = ((current_net_rx - state.last_net_rx) as f64 / elapsed) as u64;
        }
        if current_net_tx >= state.last_net_tx {
            state.net_tx_rate = ((current_net_tx - state.last_net_tx) as f64 / elapsed) as u64;
        }
        if current_disk_read >= state.last_disk_read {
            state.disk_read_rate = ((current_disk_read - state.last_disk_read) as f64 / elapsed) as u64;
        }
        if current_disk_write >= state.last_disk_write {
            state.disk_write_rate = ((current_disk_write - state.last_disk_write) as f64 / elapsed) as u64;
        }
        
        // Update last values
        state.last_update = Instant::now();
        state.last_net_rx = current_net_rx;
        state.last_net_tx = current_net_tx;
        state.last_disk_read = current_disk_read;
        state.last_disk_write = current_disk_write;
    }
    
    (state.disk_read_rate, state.disk_write_rate, state.net_rx_rate, state.net_tx_rate)
}

/// Find processes related to AI model execution
pub fn find_model_processes() -> Vec<ProcessInfo> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let model_keywords = ["ollama", "llama", "python", "torch", "cuda", "transformers"];
    let mut processes = Vec::new();

    for (pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        
        if model_keywords.iter().any(|k| name.contains(k)) {
            processes.push(ProcessInfo {
                pid: pid.as_u32(),
                name: process.name().to_string_lossy().to_string(),
                cpu_usage: process.cpu_usage(),
                memory_mb: process.memory() / (1024 * 1024),
                status: format!("{:?}", process.status()),
                start_time: process.start_time(),
            });
        }
    }

    processes
}

