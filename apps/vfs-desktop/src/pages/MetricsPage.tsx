/**
 * MetricsPage - Optimized metrics dashboard
 * Clean 2-column layout with essential metrics only
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
  temperature: 85,
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

const formatUptime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getUsageColor = (value: number) => {
  if (value < 50) return 'var(--success)';
  if (value < 80) return 'var(--warning)';
  return 'var(--error)';
};

const getStatusClass = (value: number): 'good' | 'warning' | 'critical' => {
  if (value < 70) return 'good';
  if (value < 90) return 'warning';
  return 'critical';
};

// Sparkline component
const Sparkline = ({
  data,
  color,
  height = 60,
}: {
  data: number[];
  color: string;
  height?: number;
}) => {
  if (data.length < 2)
    return <div className="sparkline-empty" style={{ height }} />;

  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 85 - 5}`,
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
          id={`grad-${color.replace(/\W/g, '')}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#grad-${color.replace(/\W/g, '')})`}
      />
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

// Gauge component
const Gauge = ({
  value,
  max = 100,
  label,
  unit = '%',
  size = 100,
}: {
  value: number;
  max?: number;
  label: string;
  unit?: string;
  size?: number;
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * Math.PI * 1.5;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="gauge-container" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="gauge-svg">
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
        <circle
          className="gauge-value"
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

export function MetricsPage() {
  const { showToast } = useToast();
  const [metrics, setMetrics] = useState<AllMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uptime, setUptime] = useState(0);
  const alertedRef = useRef<Set<string>>(new Set());
  const [historicalData, setHistoricalData] = useState<{
    cpu: number[];
    memory: number[];
    gpu: number[];
    diskRead: number[];
    diskWrite: number[];
    netRx: number[];
    netTx: number[];
  }>({
    cpu: [],
    memory: [],
    gpu: [],
    diskRead: [],
    diskWrite: [],
    netRx: [],
    netTx: [],
  });

  const checkThresholds = useCallback(
    (data: AllMetrics) => {
      const alerts = alertedRef.current;

      if (data.system.cpu_usage >= THRESHOLDS.cpu && !alerts.has('cpu')) {
        showToast({
          type: 'warning',
          message: `CPU critical: ${data.system.cpu_usage.toFixed(0)}%`,
          duration: 5000,
        });
        alerts.add('cpu');
      } else if (data.system.cpu_usage < THRESHOLDS.cpu) {
        alerts.delete('cpu');
      }

      if (
        data.system.memory_usage_percent >= THRESHOLDS.memory &&
        !alerts.has('memory')
      ) {
        showToast({
          type: 'warning',
          message: `Memory critical: ${data.system.memory_usage_percent.toFixed(0)}%`,
          duration: 5000,
        });
        alerts.add('memory');
      } else if (data.system.memory_usage_percent < THRESHOLDS.memory) {
        alerts.delete('memory');
      }

      data.gpus.forEach((gpu, i) => {
        if (
          gpu.current.gpu_utilization >= THRESHOLDS.gpu &&
          !alerts.has(`gpu-${i}`)
        ) {
          showToast({
            type: 'warning',
            message: `GPU at ${gpu.current.gpu_utilization.toFixed(0)}%`,
            duration: 5000,
          });
          alerts.add(`gpu-${i}`);
        } else if (gpu.current.gpu_utilization < THRESHOLDS.gpu) {
          alerts.delete(`gpu-${i}`);
        }

        if (
          gpu.current.temperature_celsius &&
          gpu.current.temperature_celsius >= THRESHOLDS.temperature &&
          !alerts.has(`temp-${i}`)
        ) {
          showToast({
            type: 'error',
            message: `GPU temp: ${gpu.current.temperature_celsius.toFixed(0)}°C`,
            duration: 5000,
          });
          alerts.add(`temp-${i}`);
        } else if (
          !gpu.current.temperature_celsius ||
          gpu.current.temperature_celsius < THRESHOLDS.temperature
        ) {
          alerts.delete(`temp-${i}`);
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
      checkThresholds(data);

      setHistoricalData((prev) => ({
        cpu: [...prev.cpu.slice(-59), data.system.cpu_usage],
        memory: [...prev.memory.slice(-59), data.system.memory_usage_percent],
        gpu: [
          ...prev.gpu.slice(-59),
          data.gpus[0]?.current.gpu_utilization ?? 0,
        ],
        diskRead: [
          ...prev.diskRead.slice(-59),
          data.system.disk_read_bytes_sec,
        ],
        diskWrite: [
          ...prev.diskWrite.slice(-59),
          data.system.disk_write_bytes_sec,
        ],
        netRx: [...prev.netRx.slice(-59), data.system.network_rx_bytes_sec],
        netTx: [...prev.netTx.slice(-59), data.system.network_tx_bytes_sec],
      }));
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    }
  }, [checkThresholds]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (error) {
    return (
      <div className="metrics-page">
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
          <h2>Metrics Unavailable</h2>
          <p>{error}</p>
          <button className="retry-btn" onClick={fetchMetrics}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="metrics-page">
        <div className="metrics-loading">
          <div className="loader-ring" />
          <span>Loading metrics...</span>
        </div>
      </div>
    );
  }

  const gpu = metrics.gpus[0];
  const cpuStatus = getStatusClass(metrics.system.cpu_usage);
  const memStatus = getStatusClass(metrics.system.memory_usage_percent);
  const gpuStatus = gpu ? getStatusClass(gpu.current.gpu_utilization) : 'good';

  return (
    <div className="metrics-page">
      {/* Header */}
      <div className="metrics-header">
        <div className="header-title">
          <h1>Performance</h1>
          <span className="header-subtitle">Live monitoring</span>
        </div>
        <div className="header-meta">
          <div className="meta-item">
            <span className="meta-label">Uptime</span>
            <span className="meta-value">{formatUptime(uptime)}</span>
          </div>
        </div>
      </div>

      {/* Top Gauges */}
      <div className="metrics-gauge-row">
        <Gauge value={metrics.system.cpu_usage} label="CPU" size={100} />
        <Gauge
          value={metrics.system.memory_usage_percent}
          label="Memory"
          size={100}
        />
        {gpu && (
          <Gauge value={gpu.current.gpu_utilization} label="GPU" size={100} />
        )}
        {gpu && (
          <Gauge
            value={gpu.current.memory_utilization}
            label="VRAM"
            size={100}
          />
        )}
        {gpu?.current.temperature_celsius && (
          <Gauge
            value={gpu.current.temperature_celsius}
            max={100}
            label="Temp"
            unit="°C"
            size={100}
          />
        )}
      </div>

      {/* 2-Column Grid */}
      <div className="metrics-grid">
        {/* CPU Panel */}
        <div
          className={`metric-panel ${cpuStatus === 'critical' ? 'status-critical' : cpuStatus === 'warning' ? 'status-warning' : ''}`}
        >
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-icon">
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
                </svg>
              </span>
              CPU
              <span className={`status-dot ${cpuStatus}`} />
            </div>
            <span
              className="panel-value"
              style={{ color: getUsageColor(metrics.system.cpu_usage) }}
            >
              {metrics.system.cpu_usage.toFixed(1)}%
            </span>
          </div>
          <div className="panel-content">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${metrics.system.cpu_usage}%`,
                  backgroundColor: getUsageColor(metrics.system.cpu_usage),
                }}
              />
            </div>
            <div className="sparkline-container">
              <Sparkline data={historicalData.cpu} color="var(--primary)" />
            </div>
            <div className="stats-row">
              <div className="stat-item">
                <span className="stat-label">Avg</span>
                <span className="stat-value">
                  {historicalData.cpu.length > 0
                    ? (
                        historicalData.cpu.reduce((a, b) => a + b, 0) /
                        historicalData.cpu.length
                      ).toFixed(1)
                    : 0}
                  %
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Peak</span>
                <span className="stat-value">
                  {historicalData.cpu.length > 0
                    ? Math.max(...historicalData.cpu).toFixed(0)
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Memory Panel */}
        <div
          className={`metric-panel ${memStatus === 'critical' ? 'status-critical' : memStatus === 'warning' ? 'status-warning' : ''}`}
        >
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-icon">
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
              Memory
              <span className={`status-dot ${memStatus}`} />
            </div>
            <span
              className="panel-value"
              style={{
                color: getUsageColor(metrics.system.memory_usage_percent),
              }}
            >
              {metrics.system.memory_usage_percent.toFixed(1)}%
            </span>
          </div>
          <div className="panel-content">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${metrics.system.memory_usage_percent}%`,
                  backgroundColor: getUsageColor(
                    metrics.system.memory_usage_percent,
                  ),
                }}
              />
            </div>
            <div className="sparkline-container">
              <Sparkline
                data={historicalData.memory}
                color="var(--secondary)"
              />
            </div>
            <div className="stats-row">
              <div className="stat-item">
                <span className="stat-label">Used</span>
                <span className="stat-value">
                  {(metrics.system.memory_used_mb / 1024).toFixed(1)} GB
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total</span>
                <span className="stat-value">
                  {(metrics.system.memory_total_mb / 1024).toFixed(0)} GB
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* GPU Panel */}
        {gpu && (
          <div
            className={`metric-panel ${gpuStatus === 'critical' ? 'status-critical' : gpuStatus === 'warning' ? 'status-warning' : ''}`}
          >
            <div className="panel-header">
              <div className="panel-title">
                <span className="panel-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M6 8h4M14 8h4M6 12h4M14 12h4M6 16h4M14 16h4" />
                  </svg>
                </span>
                GPU
                <span className={`status-dot ${gpuStatus}`} />
              </div>
              <span
                className="panel-value"
                style={{ color: getUsageColor(gpu.current.gpu_utilization) }}
              >
                {gpu.current.gpu_utilization.toFixed(0)}%
              </span>
            </div>
            <div className="panel-content">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${gpu.current.gpu_utilization}%`,
                    backgroundColor: getUsageColor(gpu.current.gpu_utilization),
                  }}
                />
              </div>
              <div className="sparkline-container">
                <Sparkline
                  data={historicalData.gpu}
                  color="var(--accent, #10b981)"
                />
              </div>
              <div className="stats-row">
                <div className="stat-item">
                  <span className="stat-label">VRAM</span>
                  <span className="stat-value">
                    {(gpu.current.memory_used_mb / 1024).toFixed(1)} /{' '}
                    {(gpu.info.memory_total_mb / 1024).toFixed(0)} GB
                  </span>
                </div>
                {gpu.current.temperature_celsius && (
                  <div className="stat-item">
                    <span className="stat-label">Temp</span>
                    <span
                      className="stat-value"
                      style={{
                        color: getUsageColor(gpu.current.temperature_celsius),
                      }}
                    >
                      {gpu.current.temperature_celsius.toFixed(0)}°C
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Disk I/O Panel */}
        <div className="metric-panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </span>
              Disk I/O
            </div>
            <span className="panel-value">
              {formatThroughput(
                metrics.system.disk_read_bytes_sec +
                  metrics.system.disk_write_bytes_sec,
              )}
            </span>
          </div>
          <div className="panel-content">
            <div className="io-stats">
              <div className="io-stat read">
                <span className="io-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="17 11 12 6 7 11" />
                    <line x1="12" y1="6" x2="12" y2="18" />
                  </svg>
                </span>
                <div className="io-info">
                  <span className="io-label">Read</span>
                  <span className="io-value">
                    {formatThroughput(metrics.system.disk_read_bytes_sec)}
                  </span>
                </div>
              </div>
              <div className="io-stat write">
                <span className="io-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="7 13 12 18 17 13" />
                    <line x1="12" y1="6" x2="12" y2="18" />
                  </svg>
                </span>
                <div className="io-info">
                  <span className="io-label">Write</span>
                  <span className="io-value">
                    {formatThroughput(metrics.system.disk_write_bytes_sec)}
                  </span>
                </div>
              </div>
            </div>
            <div className="sparkline-container">
              <Sparkline
                data={historicalData.diskRead.map(
                  (r, i) => r + (historicalData.diskWrite[i] || 0),
                )}
                color="var(--primary)"
              />
            </div>
          </div>
        </div>

        {/* Network Panel */}
        <div className="metric-panel">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-icon">
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
              </span>
              Network
            </div>
            <span className="panel-value">
              {formatThroughput(
                metrics.system.network_rx_bytes_sec +
                  metrics.system.network_tx_bytes_sec,
              )}
            </span>
          </div>
          <div className="panel-content">
            <div className="io-stats">
              <div className="io-stat download">
                <span className="io-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="7 13 12 18 17 13" />
                    <line x1="12" y1="6" x2="12" y2="18" />
                  </svg>
                </span>
                <div className="io-info">
                  <span className="io-label">Download</span>
                  <span className="io-value">
                    {formatThroughput(metrics.system.network_rx_bytes_sec)}
                  </span>
                </div>
              </div>
              <div className="io-stat upload">
                <span className="io-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="17 11 12 6 7 11" />
                    <line x1="12" y1="6" x2="12" y2="18" />
                  </svg>
                </span>
                <div className="io-info">
                  <span className="io-label">Upload</span>
                  <span className="io-value">
                    {formatThroughput(metrics.system.network_tx_bytes_sec)}
                  </span>
                </div>
              </div>
            </div>
            <div className="sparkline-container">
              <Sparkline
                data={historicalData.netRx.map(
                  (r, i) => r + (historicalData.netTx[i] || 0),
                )}
                color="var(--secondary)"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="metrics-footer">
        <div className="threshold-info">
          <span>Thresholds:</span>
          <span className="threshold-item">
            <span className="threshold-dot warning" /> &gt;70% Warning
          </span>
          <span className="threshold-item">
            <span className="threshold-dot critical" /> &gt;90% Critical
          </span>
        </div>
      </div>
    </div>
  );
}
