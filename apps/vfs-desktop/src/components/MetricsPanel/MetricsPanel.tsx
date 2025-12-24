import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './MetricsPanel.css';

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

type ViewMode = 'collapsed' | 'compact' | 'expanded' | 'fullscreen';

interface MetricsPanelProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

// Calculate IOPS from bytes/sec (assuming 4KB blocks)
const calculateIOPS = (bytesPerSec: number) => {
  return Math.round(bytesPerSec / 4096);
};

export function MetricsPanel({
  isCollapsed = false,
  onToggle,
}: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<AllMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(
    isCollapsed ? 'collapsed' : 'compact',
  );
  const [historicalData, setHistoricalData] = useState<{
    cpu: number[];
    gpu: number[];
    diskRead: number[];
    diskWrite: number[];
    netRx: number[];
    netTx: number[];
  }>({
    cpu: [],
    gpu: [],
    diskRead: [],
    diskWrite: [],
    netRx: [],
    netTx: [],
  });

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await invoke<AllMetrics>('get_all_metrics');
      setMetrics(data);
      setError(null);

      // Update historical data (keep last 30 samples)
      setHistoricalData((prev) => ({
        cpu: [...prev.cpu.slice(-29), data.system.cpu_usage],
        gpu: [
          ...prev.gpu.slice(-29),
          data.gpus[0]?.current.gpu_utilization ?? 0,
        ],
        diskRead: [
          ...prev.diskRead.slice(-29),
          data.system.disk_read_bytes_sec,
        ],
        diskWrite: [
          ...prev.diskWrite.slice(-29),
          data.system.disk_write_bytes_sec,
        ],
        netRx: [...prev.netRx.slice(-29), data.system.network_rx_bytes_sec],
        netTx: [...prev.netTx.slice(-29), data.system.network_tx_bytes_sec],
      }));
    } catch (err) {
      setError('Failed to fetch metrics');
      console.error('Metrics error:', err);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  useEffect(() => {
    setViewMode(isCollapsed ? 'collapsed' : 'compact');
  }, [isCollapsed]);

  const getUsageColor = (value: number) => {
    if (value < 50) return 'var(--success)';
    if (value < 80) return 'var(--warning)';
    return 'var(--error)';
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes.toFixed(0)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatThroughput = (bytesPerSec: number) => {
    return `${formatBytes(bytesPerSec)}/s`;
  };

  const cycleViewMode = () => {
    const modes: ViewMode[] = [
      'collapsed',
      'compact',
      'expanded',
      'fullscreen',
    ];
    const currentIndex = modes.indexOf(viewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setViewMode(modes[nextIndex]);
    if (modes[nextIndex] === 'collapsed' && onToggle) {
      onToggle();
    }
  };

  const toggleFullscreen = () => {
    setViewMode(viewMode === 'fullscreen' ? 'expanded' : 'fullscreen');
  };

  // Collapsed view - just an icon button
  if (viewMode === 'collapsed') {
    return (
      <button
        className="metrics-panel-collapsed"
        onClick={() => setViewMode('compact')}
        title="Show Metrics"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </button>
    );
  }

  // Sparkline component for mini charts
  const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const points = data
      .map(
        (v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 100}`,
      )
      .join(' ');
    return (
      <svg
        className="sparkline"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
      </svg>
    );
  };

  return (
    <div className={`metrics-panel ${viewMode}`}>
      {/* Header */}
      <div className="metrics-panel-header">
        <span className="metrics-panel-title">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          System Metrics
        </span>
        <div className="metrics-panel-controls">
          <button
            className="metrics-control-btn"
            onClick={() =>
              setViewMode(viewMode === 'expanded' ? 'compact' : 'expanded')
            }
            title={viewMode === 'expanded' ? 'Compact View' : 'Expand'}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {viewMode === 'expanded' ? (
                <polyline points="4 14 10 14 10 20" />
              ) : (
                <polyline points="15 3 21 3 21 9" />
              )}
              <line x1="14" y1="10" x2="21" y2="3" />
            </svg>
          </button>
          <button
            className="metrics-control-btn"
            onClick={toggleFullscreen}
            title={viewMode === 'fullscreen' ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {viewMode === 'fullscreen' ? (
                <>
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </>
              ) : (
                <>
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </>
              )}
            </svg>
          </button>
          <button
            className="metrics-control-btn close"
            onClick={() => setViewMode('collapsed')}
            title="Hide Metrics"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {error && <div className="metrics-error">{error}</div>}

      {metrics && (
        <div className="metrics-content">
          {/* GPU Section */}
          {metrics.gpus.map((gpu) => (
            <div key={gpu.info.id} className="metric-section">
              <div className="metric-section-header">
                <span className="metric-icon gpu">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <rect x="9" y="9" width="6" height="6" />
                  </svg>
                </span>
                <span className="metric-section-title">{gpu.info.name}</span>
              </div>

              <div className="metric-row">
                <span className="metric-label">Utilization</span>
                <span
                  className="metric-value"
                  style={{ color: getUsageColor(gpu.current.gpu_utilization) }}
                >
                  {gpu.current.gpu_utilization.toFixed(0)}%
                </span>
              </div>
              <div className="metric-bar">
                <div
                  className="metric-bar-fill"
                  style={{
                    width: `${gpu.current.gpu_utilization}%`,
                    backgroundColor: getUsageColor(gpu.current.gpu_utilization),
                  }}
                />
              </div>

              <div className="metric-row">
                <span className="metric-label">VRAM</span>
                <span className="metric-value">
                  {(gpu.current.memory_used_mb / 1024).toFixed(1)} /{' '}
                  {(gpu.current.memory_total_mb / 1024).toFixed(0)} GB
                </span>
              </div>
              <div className="metric-bar">
                <div
                  className="metric-bar-fill gradient"
                  style={{ width: `${gpu.current.memory_utilization}%` }}
                />
              </div>

              {(viewMode === 'expanded' || viewMode === 'fullscreen') && (
                <div className="metric-details">
                  {gpu.current.temperature_celsius !== null && (
                    <div className="metric-detail-item">
                      <span className="detail-label">Temperature</span>
                      <span
                        className="detail-value"
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
                    </div>
                  )}
                  {gpu.current.power_usage_watts !== null && (
                    <div className="metric-detail-item">
                      <span className="detail-label">Power Draw</span>
                      <span className="detail-value">
                        {gpu.current.power_usage_watts.toFixed(0)}W
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* CPU Section */}
          <div className="metric-section">
            <div className="metric-section-header">
              <span className="metric-icon cpu">
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
              <span className="metric-section-title">CPU</span>
              {(viewMode === 'expanded' || viewMode === 'fullscreen') && (
                <Sparkline data={historicalData.cpu} color="var(--primary)" />
              )}
            </div>

            <div className="metric-row">
              <span className="metric-label">Usage</span>
              <span
                className="metric-value"
                style={{ color: getUsageColor(metrics.system.cpu_usage) }}
              >
                {metrics.system.cpu_usage.toFixed(0)}%
              </span>
            </div>
            <div className="metric-bar">
              <div
                className="metric-bar-fill"
                style={{
                  width: `${metrics.system.cpu_usage}%`,
                  backgroundColor: getUsageColor(metrics.system.cpu_usage),
                }}
              />
            </div>
          </div>

          {/* Memory Section */}
          <div className="metric-section">
            <div className="metric-section-header">
              <span className="metric-icon memory">
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
              <span className="metric-section-title">Memory</span>
            </div>

            <div className="metric-row">
              <span className="metric-label">RAM</span>
              <span className="metric-value">
                {(metrics.system.memory_used_mb / 1024).toFixed(1)} /{' '}
                {(metrics.system.memory_total_mb / 1024).toFixed(0)} GB
              </span>
            </div>
            <div className="metric-bar">
              <div
                className="metric-bar-fill gradient"
                style={{ width: `${metrics.system.memory_usage_percent}%` }}
              />
            </div>
          </div>

          {/* Storage I/O Section */}
          <div className="metric-section">
            <div className="metric-section-header">
              <span className="metric-icon disk">
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
              </span>
              <span className="metric-section-title">Storage I/O</span>
            </div>

            <div className="io-metrics-grid">
              <div className="io-metric">
                <span className="io-label">Read</span>
                <span className="io-value read">
                  {formatThroughput(metrics.system.disk_read_bytes_sec)}
                </span>
                {(viewMode === 'expanded' || viewMode === 'fullscreen') && (
                  <span className="io-iops">
                    {calculateIOPS(metrics.system.disk_read_bytes_sec)} IOPS
                  </span>
                )}
              </div>
              <div className="io-metric">
                <span className="io-label">Write</span>
                <span className="io-value write">
                  {formatThroughput(metrics.system.disk_write_bytes_sec)}
                </span>
                {(viewMode === 'expanded' || viewMode === 'fullscreen') && (
                  <span className="io-iops">
                    {calculateIOPS(metrics.system.disk_write_bytes_sec)} IOPS
                  </span>
                )}
              </div>
            </div>

            {(viewMode === 'expanded' || viewMode === 'fullscreen') && (
              <div className="io-sparklines">
                <div className="sparkline-container">
                  <span className="sparkline-label">Read Throughput</span>
                  <Sparkline
                    data={historicalData.diskRead}
                    color="var(--success)"
                  />
                </div>
                <div className="sparkline-container">
                  <span className="sparkline-label">Write Throughput</span>
                  <Sparkline
                    data={historicalData.diskWrite}
                    color="var(--warning)"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Network Section */}
          <div className="metric-section">
            <div className="metric-section-header">
              <span className="metric-icon network">
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
              <span className="metric-section-title">Network</span>
            </div>

            <div className="io-metrics-grid">
              <div className="io-metric">
                <span className="io-label">↓ Download</span>
                <span className="io-value download">
                  {formatThroughput(metrics.system.network_rx_bytes_sec)}
                </span>
              </div>
              <div className="io-metric">
                <span className="io-label">↑ Upload</span>
                <span className="io-value upload">
                  {formatThroughput(metrics.system.network_tx_bytes_sec)}
                </span>
              </div>
            </div>

            {(viewMode === 'expanded' || viewMode === 'fullscreen') && (
              <div className="io-sparklines">
                <div className="sparkline-container">
                  <span className="sparkline-label">Receive</span>
                  <Sparkline
                    data={historicalData.netRx}
                    color="var(--primary)"
                  />
                </div>
                <div className="sparkline-container">
                  <span className="sparkline-label">Transmit</span>
                  <Sparkline
                    data={historicalData.netTx}
                    color="var(--secondary)"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fullscreen mode: Summary stats */}
          {viewMode === 'fullscreen' && (
            <div className="metric-section summary-section">
              <div className="metric-section-header">
                <span className="metric-icon summary">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 20V10" />
                    <path d="M12 20V4" />
                    <path d="M6 20v-6" />
                  </svg>
                </span>
                <span className="metric-section-title">
                  Performance Summary
                </span>
              </div>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">Total Disk IOPS</span>
                  <span className="summary-value">
                    {calculateIOPS(
                      metrics.system.disk_read_bytes_sec +
                        metrics.system.disk_write_bytes_sec,
                    )}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Disk Throughput</span>
                  <span className="summary-value">
                    {formatThroughput(
                      metrics.system.disk_read_bytes_sec +
                        metrics.system.disk_write_bytes_sec,
                    )}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Network Throughput</span>
                  <span className="summary-value">
                    {formatThroughput(
                      metrics.system.network_rx_bytes_sec +
                        metrics.system.network_tx_bytes_sec,
                    )}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">System Load</span>
                  <span
                    className="summary-value"
                    style={{
                      color: getUsageColor(
                        (metrics.system.cpu_usage +
                          metrics.system.memory_usage_percent) /
                          2,
                      ),
                    }}
                  >
                    {(
                      (metrics.system.cpu_usage +
                        metrics.system.memory_usage_percent) /
                      2
                    ).toFixed(0)}
                    %
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MetricsPanel;
