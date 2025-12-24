/**
 * MetricsPage - Full-page metrics dashboard
 * Shows comprehensive system and GPU metrics with expandable sections
 * Triggers toast notifications when thresholds exceed 90%
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../components/Toast';
import './MetricsPage.css';

// Types matching Rust backend
interface GpuInfo {
  id: number;
  name: string;
  vendor: string;
  memory_total_mb: number;
}

interface GpuMetrics {
  gpu_utilization: number;
  memory_used_mb: number;
  memory_total_mb: number;
  memory_utilization: number;
  temperature_celsius: number | null;
  power_usage_watts: number | null;
}

interface SystemMetrics {
  cpu_usage: number;
  memory_used_mb: number;
  memory_total_mb: number;
  memory_usage_percent: number;
  disk_read_bytes_sec: number;
  disk_write_bytes_sec: number;
  network_rx_bytes_sec: number;
  network_tx_bytes_sec: number;
}

interface GpuWithMetrics {
  info: GpuInfo;
  current: GpuMetrics;
}

interface AllMetrics {
  gpus: GpuWithMetrics[];
  system: SystemMetrics;
}

// Threshold configuration
const THRESHOLDS = {
  cpu: 90,
  memory: 90,
  gpu: 90,
  gpuMemory: 90,
  temperature: 85, // °C
};

// Helper functions
const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatThroughput = (bytesPerSec: number) =>
  `${formatBytes(bytesPerSec)}/s`;

const calculateIOPS = (bytesPerSec: number) => Math.round(bytesPerSec / 4096);

const getUsageColor = (value: number) => {
  if (value < 50) return 'var(--success)';
  if (value < 80) return 'var(--warning)';
  return 'var(--error)';
};

const getStatusClass = (value: number) => {
  if (value < 50) return 'status-good';
  if (value < 80) return 'status-moderate';
  return 'status-critical';
};

// Sparkline component with gradient fill
const Sparkline = ({
  data,
  color,
  height = 40,
  showArea = true,
}: {
  data: number[];
  color: string;
  height?: number;
  showArea?: boolean;
}) => {
  if (data.length < 2)
    return <div className="sparkline-empty" style={{ height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 80 - 10}`,
    )
    .join(' ');
  const areaPoints = `0,100 ${points} 100,100`;

  return (
    <svg
      className="sparkline"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ height }}
    >
      <defs>
        <linearGradient
          id={`gradient-${color.replace(/[^a-zA-Z]/g, '')}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showArea && (
        <polygon
          points={areaPoints}
          fill={`url(#gradient-${color.replace(/[^a-zA-Z]/g, '')})`}
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

// Gauge component for visual representation
const Gauge = ({
  value,
  max = 100,
  label,
  unit = '%',
  size = 120,
}: {
  value: number;
  max?: number;
  label: string;
  unit?: string;
  size?: number;
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * Math.PI * 1.5; // 270 degrees
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="gauge-container" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="gauge-svg">
        {/* Background arc */}
        <circle
          className="gauge-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference * 0.33}`}
          strokeDashoffset={0}
          transform={`rotate(135 ${size / 2} ${size / 2})`}
        />
        {/* Value arc */}
        <circle
          className={`gauge-value ${getStatusClass(percentage)}`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference * 0.33}`}
          strokeDashoffset={offset}
          transform={`rotate(135 ${size / 2} ${size / 2})`}
          style={{ stroke: getUsageColor(percentage) }}
        />
      </svg>
      <div className="gauge-content">
        <span
          className="gauge-value-text"
          style={{ color: getUsageColor(percentage) }}
        >
          {value.toFixed(0)}
          <span className="gauge-unit">{unit}</span>
        </span>
        <span className="gauge-label">{label}</span>
      </div>
    </div>
  );
};

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  status?: 'good' | 'moderate' | 'critical';
}

function CollapsibleSection({
  title,
  icon,
  children,
  defaultExpanded = true,
  status,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`metrics-section ${isExpanded ? 'expanded' : 'collapsed'} ${status ? `status-${status}` : ''}`}
    >
      <button
        className="section-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="section-title">
          <span className="section-icon">{icon}</span>
          <span>{title}</span>
          {status && <span className={`status-indicator ${status}`} />}
        </div>
        <svg
          className="chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline
            points={isExpanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}
          />
        </svg>
      </button>
      {isExpanded && <div className="section-content">{children}</div>}
    </div>
  );
}

export function MetricsPage() {
  const { showToast } = useToast();
  const [metrics, setMetrics] = useState<AllMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uptime, setUptime] = useState(0);
  const alertedRef = useRef<Set<string>>(new Set());
  const [historicalData, setHistoricalData] = useState<{
    cpu: number[];
    gpu: number[];
    diskRead: number[];
    diskWrite: number[];
    netRx: number[];
    netTx: number[];
    memory: number[];
    gpuMemory: number[];
    temperature: number[];
  }>({
    cpu: [],
    gpu: [],
    diskRead: [],
    diskWrite: [],
    netRx: [],
    netTx: [],
    memory: [],
    gpuMemory: [],
    temperature: [],
  });

  // Check thresholds and trigger alerts
  const checkThresholds = useCallback(
    (data: AllMetrics) => {
      const alerts = alertedRef.current;

      // CPU threshold
      if (data.system.cpu_usage >= THRESHOLDS.cpu) {
        if (!alerts.has('cpu')) {
          showToast({
            type: 'warning',
            message: `CPU usage critical: ${data.system.cpu_usage.toFixed(0)}%`,
            duration: 5000,
          });
          alerts.add('cpu');
        }
      } else {
        alerts.delete('cpu');
      }

      // Memory threshold
      if (data.system.memory_usage_percent >= THRESHOLDS.memory) {
        if (!alerts.has('memory')) {
          showToast({
            type: 'warning',
            message: `Memory usage critical: ${data.system.memory_usage_percent.toFixed(0)}%`,
            duration: 5000,
          });
          alerts.add('memory');
        }
      } else {
        alerts.delete('memory');
      }

      // GPU thresholds
      data.gpus.forEach((gpu, index) => {
        const gpuKey = `gpu-${index}`;
        const gpuMemKey = `gpu-mem-${index}`;
        const tempKey = `temp-${index}`;

        // GPU utilization
        if (gpu.current.gpu_utilization >= THRESHOLDS.gpu) {
          if (!alerts.has(gpuKey)) {
            showToast({
              type: 'warning',
              message: `GPU ${gpu.info.name} at ${gpu.current.gpu_utilization.toFixed(0)}%`,
              duration: 5000,
            });
            alerts.add(gpuKey);
          }
        } else {
          alerts.delete(gpuKey);
        }

        // GPU memory
        if (gpu.current.memory_utilization >= THRESHOLDS.gpuMemory) {
          if (!alerts.has(gpuMemKey)) {
            showToast({
              type: 'warning',
              message: `GPU VRAM critical: ${gpu.current.memory_utilization.toFixed(0)}%`,
              duration: 5000,
            });
            alerts.add(gpuMemKey);
          }
        } else {
          alerts.delete(gpuMemKey);
        }

        // Temperature
        if (
          gpu.current.temperature_celsius &&
          gpu.current.temperature_celsius >= THRESHOLDS.temperature
        ) {
          if (!alerts.has(tempKey)) {
            showToast({
              type: 'error',
              message: `GPU temperature warning: ${gpu.current.temperature_celsius.toFixed(0)}°C`,
              duration: 5000,
            });
            alerts.add(tempKey);
          }
        } else {
          alerts.delete(tempKey);
        }
      });
    },
    [showToast],
  );

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await invoke<AllMetrics>('get_all_metrics');
      setMetrics(data);
      setError(null);
      setUptime((prev) => prev + 2);

      // Check thresholds
      checkThresholds(data);

      // Update historical data (keep last 120 samples = 4 min at 2s interval)
      setHistoricalData((prev) => ({
        cpu: [...prev.cpu.slice(-119), data.system.cpu_usage],
        gpu: [
          ...prev.gpu.slice(-119),
          data.gpus[0]?.current.gpu_utilization ?? 0,
        ],
        diskRead: [
          ...prev.diskRead.slice(-119),
          data.system.disk_read_bytes_sec,
        ],
        diskWrite: [
          ...prev.diskWrite.slice(-119),
          data.system.disk_write_bytes_sec,
        ],
        netRx: [...prev.netRx.slice(-119), data.system.network_rx_bytes_sec],
        netTx: [...prev.netTx.slice(-119), data.system.network_tx_bytes_sec],
        memory: [...prev.memory.slice(-119), data.system.memory_usage_percent],
        gpuMemory: [
          ...prev.gpuMemory.slice(-119),
          data.gpus[0]?.current.memory_utilization ?? 0,
        ],
        temperature: [
          ...prev.temperature.slice(-119),
          data.gpus[0]?.current.temperature_celsius ?? 0,
        ],
      }));
    } catch (err) {
      setError('Failed to fetch metrics');
      console.error('Metrics error:', err);
    }
  }, [checkThresholds]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  if (error) {
    return (
      <div className="metrics-page full-page">
        <div className="metrics-error">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2>Unable to fetch metrics</h2>
          <p>{error}</p>
          <button className="retry-btn" onClick={() => fetchMetrics()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="metrics-page full-page">
        <div className="metrics-loading">
          <div className="loader-ring"></div>
          <span>Initializing metrics collection...</span>
        </div>
      </div>
    );
  }

  const totalDiskThroughput =
    metrics.system.disk_read_bytes_sec + metrics.system.disk_write_bytes_sec;
  const totalNetThroughput =
    metrics.system.network_rx_bytes_sec + metrics.system.network_tx_bytes_sec;
  const totalDiskIOPS = calculateIOPS(totalDiskThroughput);

  // Calculate averages for summaries
  const avgCpu =
    historicalData.cpu.length > 0
      ? historicalData.cpu.reduce((a, b) => a + b, 0) /
        historicalData.cpu.length
      : metrics.system.cpu_usage;
  const peakCpu =
    historicalData.cpu.length > 0
      ? Math.max(...historicalData.cpu)
      : metrics.system.cpu_usage;
  const avgMemory =
    historicalData.memory.length > 0
      ? historicalData.memory.reduce((a, b) => a + b, 0) /
        historicalData.memory.length
      : metrics.system.memory_usage_percent;

  // Determine section status based on current values
  const cpuStatus =
    metrics.system.cpu_usage >= 90
      ? 'critical'
      : metrics.system.cpu_usage >= 70
        ? 'moderate'
        : 'good';
  const memStatus =
    metrics.system.memory_usage_percent >= 90
      ? 'critical'
      : metrics.system.memory_usage_percent >= 70
        ? 'moderate'
        : 'good';
  const gpuStatus =
    metrics.gpus[0]?.current.gpu_utilization >= 90
      ? 'critical'
      : (metrics.gpus[0]?.current.gpu_utilization ?? 0) >= 70
        ? 'moderate'
        : 'good';

  return (
    <div className="metrics-page full-page">
      {/* Top Summary Row with Gauges */}
      <div className="metrics-header">
        <div className="header-title">
          <h1>System Performance</h1>
          <span className="header-subtitle">
            Real-time monitoring • Updated every 2s
          </span>
        </div>
        <div className="header-meta">
          <div className="meta-item">
            <span className="meta-label">Session</span>
            <span className="meta-value">{formatUptime(uptime)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Samples</span>
            <span className="meta-value">{historicalData.cpu.length}</span>
          </div>
        </div>
      </div>

      {/* Gauge Summary Row */}
      <div className="metrics-gauge-row">
        <Gauge value={metrics.system.cpu_usage} label="CPU" size={140} />
        <Gauge
          value={metrics.system.memory_usage_percent}
          label="Memory"
          size={140}
        />
        {metrics.gpus[0] && (
          <Gauge
            value={metrics.gpus[0].current.gpu_utilization}
            label="GPU"
            size={140}
          />
        )}
        {metrics.gpus[0] && (
          <Gauge
            value={metrics.gpus[0].current.memory_utilization}
            label="VRAM"
            size={140}
          />
        )}
        {metrics.gpus[0]?.current.temperature_celsius && (
          <Gauge
            value={metrics.gpus[0].current.temperature_celsius}
            max={100}
            label="Temp"
            unit="°C"
            size={140}
          />
        )}
      </div>

      {/* Quick Stats Bar */}
      <div className="metrics-quick-stats">
        <div className="quick-stat">
          <span className="stat-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </span>
          <div className="stat-content">
            <span className="stat-label">Disk I/O</span>
            <span className="stat-value">
              {formatThroughput(totalDiskThroughput)}
            </span>
            <span className="stat-secondary">{totalDiskIOPS} IOPS</span>
          </div>
        </div>
        <div className="quick-stat">
          <span className="stat-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <circle cx="12" cy="20" r="1" />
            </svg>
          </span>
          <div className="stat-content">
            <span className="stat-label">Network</span>
            <span className="stat-value">
              {formatThroughput(totalNetThroughput)}
            </span>
            <span className="stat-secondary">
              ↓{formatThroughput(metrics.system.network_rx_bytes_sec)} ↑
              {formatThroughput(metrics.system.network_tx_bytes_sec)}
            </span>
          </div>
        </div>
        <div className="quick-stat">
          <span className="stat-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </span>
          <div className="stat-content">
            <span className="stat-label">Avg CPU</span>
            <span className="stat-value">{avgCpu.toFixed(1)}%</span>
            <span className="stat-secondary">Peak: {peakCpu.toFixed(0)}%</span>
          </div>
        </div>
        <div className="quick-stat">
          <span className="stat-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01" />
            </svg>
          </span>
          <div className="stat-content">
            <span className="stat-label">Avg Memory</span>
            <span className="stat-value">{avgMemory.toFixed(1)}%</span>
            <span className="stat-secondary">
              {(metrics.system.memory_used_mb / 1024).toFixed(1)} GB used
            </span>
          </div>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="metrics-grid full-width">
        {/* CPU Section */}
        <CollapsibleSection
          title="CPU Performance"
          status={cpuStatus}
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <line x1="9" y1="1" x2="9" y2="4" />
              <line x1="15" y1="1" x2="15" y2="4" />
              <line x1="9" y1="20" x2="9" y2="23" />
              <line x1="15" y1="20" x2="15" y2="23" />
              <line x1="1" y1="9" x2="4" y2="9" />
              <line x1="1" y1="15" x2="4" y2="15" />
              <line x1="20" y1="9" x2="23" y2="9" />
              <line x1="20" y1="15" x2="23" y2="15" />
            </svg>
          }
        >
          <div className="metric-card full-width">
            <div className="metric-main-row">
              <div className="metric-primary">
                <span className="metric-label">Current Usage</span>
                <span
                  className="metric-value large"
                  style={{ color: getUsageColor(metrics.system.cpu_usage) }}
                >
                  {metrics.system.cpu_usage.toFixed(1)}%
                </span>
                <div className="progress-bar large">
                  <div
                    className="progress-fill animated"
                    style={{
                      width: `${metrics.system.cpu_usage}%`,
                      backgroundColor: getUsageColor(metrics.system.cpu_usage),
                    }}
                  />
                </div>
              </div>
              <div className="metric-stats">
                <div className="stat-item">
                  <span className="stat-label">Average</span>
                  <span className="stat-value">{avgCpu.toFixed(1)}%</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Peak</span>
                  <span className="stat-value">{peakCpu.toFixed(0)}%</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Threshold</span>
                  <span className="stat-value">{THRESHOLDS.cpu}%</span>
                </div>
              </div>
            </div>
            <div className="sparkline-large">
              <Sparkline
                data={historicalData.cpu}
                color="var(--primary)"
                height={100}
              />
              <div className="sparkline-legend">
                <span>
                  CPU Usage History - Last{' '}
                  {Math.round((historicalData.cpu.length * 2) / 60)} minutes
                </span>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Memory Section */}
        <CollapsibleSection
          title="Memory Usage"
          status={memStatus}
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01" />
            </svg>
          }
        >
          <div className="metric-card full-width">
            <div className="metric-main-row">
              <div className="metric-primary">
                <span className="metric-label">RAM Usage</span>
                <span className="metric-value large">
                  {(metrics.system.memory_used_mb / 1024).toFixed(1)}
                  <span className="metric-unit">
                    {' '}
                    / {(metrics.system.memory_total_mb / 1024).toFixed(0)} GB
                  </span>
                </span>
                <div className="progress-bar large">
                  <div
                    className="progress-fill gradient animated"
                    style={{ width: `${metrics.system.memory_usage_percent}%` }}
                  />
                </div>
              </div>
              <div className="metric-stats">
                <div className="stat-item">
                  <span className="stat-label">Used</span>
                  <span className="stat-value">
                    {(metrics.system.memory_used_mb / 1024).toFixed(2)} GB
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Available</span>
                  <span className="stat-value">
                    {(
                      (metrics.system.memory_total_mb -
                        metrics.system.memory_used_mb) /
                      1024
                    ).toFixed(2)}{' '}
                    GB
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Percentage</span>
                  <span
                    className="stat-value"
                    style={{
                      color: getUsageColor(metrics.system.memory_usage_percent),
                    }}
                  >
                    {metrics.system.memory_usage_percent.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            <div className="sparkline-large">
              <Sparkline
                data={historicalData.memory}
                color="var(--secondary)"
                height={100}
              />
              <div className="sparkline-legend">
                <span>Memory Usage History</span>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* GPU Sections */}
        {metrics.gpus.map((gpu) => (
          <CollapsibleSection
            key={gpu.info.id}
            title={gpu.info.name}
            status={gpuStatus}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
              </svg>
            }
          >
            <div className="metric-card full-width">
              <div className="gpu-grid">
                <div className="gpu-metric">
                  <span className="metric-label">Utilization</span>
                  <span
                    className="metric-value large"
                    style={{
                      color: getUsageColor(gpu.current.gpu_utilization),
                    }}
                  >
                    {gpu.current.gpu_utilization.toFixed(0)}%
                  </span>
                  <div className="progress-bar">
                    <div
                      className="progress-fill animated"
                      style={{
                        width: `${gpu.current.gpu_utilization}%`,
                        backgroundColor: getUsageColor(
                          gpu.current.gpu_utilization,
                        ),
                      }}
                    />
                  </div>
                </div>
                <div className="gpu-metric">
                  <span className="metric-label">VRAM</span>
                  <span className="metric-value large">
                    {(gpu.current.memory_used_mb / 1024).toFixed(1)}
                    <span className="metric-unit">
                      {' '}
                      / {(gpu.current.memory_total_mb / 1024).toFixed(0)} GB
                    </span>
                  </span>
                  <div className="progress-bar">
                    <div
                      className="progress-fill gradient animated"
                      style={{ width: `${gpu.current.memory_utilization}%` }}
                    />
                  </div>
                </div>
                {gpu.current.temperature_celsius !== null && (
                  <div className="gpu-metric">
                    <span className="metric-label">Temperature</span>
                    <span
                      className="metric-value large"
                      style={{
                        color:
                          gpu.current.temperature_celsius > 80
                            ? 'var(--error)'
                            : gpu.current.temperature_celsius > 60
                              ? 'var(--warning)'
                              : 'var(--success)',
                      }}
                    >
                      {gpu.current.temperature_celsius.toFixed(0)}°C
                    </span>
                    <div className="temp-bar">
                      <div
                        className="temp-fill"
                        style={{
                          width: `${Math.min((gpu.current.temperature_celsius / 100) * 100, 100)}%`,
                          backgroundColor:
                            gpu.current.temperature_celsius > 80
                              ? 'var(--error)'
                              : gpu.current.temperature_celsius > 60
                                ? 'var(--warning)'
                                : 'var(--success)',
                        }}
                      />
                    </div>
                  </div>
                )}
                {gpu.current.power_usage_watts !== null && (
                  <div className="gpu-metric">
                    <span className="metric-label">Power Draw</span>
                    <span className="metric-value large">
                      {gpu.current.power_usage_watts.toFixed(0)}W
                    </span>
                  </div>
                )}
              </div>
              <div className="sparkline-row">
                <div className="sparkline-container">
                  <Sparkline
                    data={historicalData.gpu}
                    color="var(--primary)"
                    height={80}
                  />
                  <span className="sparkline-label">GPU Utilization</span>
                </div>
                <div className="sparkline-container">
                  <Sparkline
                    data={historicalData.gpuMemory}
                    color="var(--secondary)"
                    height={80}
                  />
                  <span className="sparkline-label">VRAM Usage</span>
                </div>
                {gpu.current.temperature_celsius !== null && (
                  <div className="sparkline-container">
                    <Sparkline
                      data={historicalData.temperature}
                      color="var(--warning)"
                      height={80}
                    />
                    <span className="sparkline-label">Temperature</span>
                  </div>
                )}
              </div>
              <div className="metric-details-row">
                <div className="detail-item">
                  <span className="detail-label">Vendor</span>
                  <span className="detail-value">{gpu.info.vendor}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Total VRAM</span>
                  <span className="detail-value">
                    {(gpu.info.memory_total_mb / 1024).toFixed(0)} GB
                  </span>
                </div>
              </div>
            </div>
          </CollapsibleSection>
        ))}

        {/* Disk I/O Section */}
        <CollapsibleSection
          title="Disk I/O Performance"
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          }
        >
          <div className="metric-card full-width">
            <div className="io-grid large">
              <div className="io-item read">
                <div className="io-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="7 10 12 5 17 10" />
                    <line x1="12" y1="5" x2="12" y2="19" />
                  </svg>
                </div>
                <div className="io-details">
                  <span className="io-label">Read</span>
                  <span className="io-value">
                    {formatThroughput(metrics.system.disk_read_bytes_sec)}
                  </span>
                  <span className="io-iops">
                    {calculateIOPS(metrics.system.disk_read_bytes_sec)} IOPS
                  </span>
                </div>
              </div>
              <div className="io-item write">
                <div className="io-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="17 14 12 19 7 14" />
                    <line x1="12" y1="19" x2="12" y2="5" />
                  </svg>
                </div>
                <div className="io-details">
                  <span className="io-label">Write</span>
                  <span className="io-value">
                    {formatThroughput(metrics.system.disk_write_bytes_sec)}
                  </span>
                  <span className="io-iops">
                    {calculateIOPS(metrics.system.disk_write_bytes_sec)} IOPS
                  </span>
                </div>
              </div>
              <div className="io-item total">
                <div className="io-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div className="io-details">
                  <span className="io-label">Total</span>
                  <span className="io-value">
                    {formatThroughput(totalDiskThroughput)}
                  </span>
                  <span className="io-iops">{totalDiskIOPS} IOPS</span>
                </div>
              </div>
            </div>
            <div className="sparkline-row">
              <div className="sparkline-container">
                <Sparkline
                  data={historicalData.diskRead}
                  color="var(--success)"
                  height={80}
                />
                <span className="sparkline-label">Read Throughput</span>
              </div>
              <div className="sparkline-container">
                <Sparkline
                  data={historicalData.diskWrite}
                  color="var(--warning)"
                  height={80}
                />
                <span className="sparkline-label">Write Throughput</span>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Network Section */}
        <CollapsibleSection
          title="Network Activity"
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <circle cx="12" cy="20" r="1" />
            </svg>
          }
        >
          <div className="metric-card full-width">
            <div className="io-grid large">
              <div className="io-item download">
                <div className="io-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="17 14 12 19 7 14" />
                    <line x1="12" y1="19" x2="12" y2="5" />
                  </svg>
                </div>
                <div className="io-details">
                  <span className="io-label">Download</span>
                  <span className="io-value">
                    {formatThroughput(metrics.system.network_rx_bytes_sec)}
                  </span>
                </div>
              </div>
              <div className="io-item upload">
                <div className="io-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="7 10 12 5 17 10" />
                    <line x1="12" y1="5" x2="12" y2="19" />
                  </svg>
                </div>
                <div className="io-details">
                  <span className="io-label">Upload</span>
                  <span className="io-value">
                    {formatThroughput(metrics.system.network_tx_bytes_sec)}
                  </span>
                </div>
              </div>
              <div className="io-item total">
                <div className="io-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                    <circle cx="12" cy="20" r="1" />
                  </svg>
                </div>
                <div className="io-details">
                  <span className="io-label">Total</span>
                  <span className="io-value">
                    {formatThroughput(totalNetThroughput)}
                  </span>
                </div>
              </div>
            </div>
            <div className="sparkline-row">
              <div className="sparkline-container">
                <Sparkline
                  data={historicalData.netRx}
                  color="var(--primary)"
                  height={80}
                />
                <span className="sparkline-label">Download</span>
              </div>
              <div className="sparkline-container">
                <Sparkline
                  data={historicalData.netTx}
                  color="var(--secondary)"
                  height={80}
                />
                <span className="sparkline-label">Upload</span>
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* Footer with threshold info */}
      <div className="metrics-footer">
        <div className="threshold-info">
          <span className="threshold-label">Alert Thresholds:</span>
          <span className="threshold-item">CPU ≥{THRESHOLDS.cpu}%</span>
          <span className="threshold-item">Memory ≥{THRESHOLDS.memory}%</span>
          <span className="threshold-item">GPU ≥{THRESHOLDS.gpu}%</span>
          <span className="threshold-item">
            Temp ≥{THRESHOLDS.temperature}°C
          </span>
        </div>
      </div>
    </div>
  );
}

export default MetricsPage;
