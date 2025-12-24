import { motion } from 'framer-motion';
import type { GpuWithMetrics, SystemMetrics } from '../types';

interface GpuMetricsPageProps {
  gpus: GpuWithMetrics[];
  systemMetrics?: SystemMetrics;
}

export function GpuMetricsPage({ gpus, systemMetrics }: GpuMetricsPageProps) {
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatMemory = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(0)} MB`;
  };

  const getUtilizationColor = (value: number) => {
    if (value < 50) return 'var(--color-success)';
    if (value < 80) return 'var(--color-warning)';
    return 'var(--color-error)';
  };

  const getTemperatureColor = (temp: number) => {
    if (temp < 60) return 'var(--color-success)';
    if (temp < 80) return 'var(--color-warning)';
    return 'var(--color-error)';
  };

  if (gpus.length === 0) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h2>GPU Metrics</h2>
          <p className="page-description">Real-time GPU monitoring</p>
        </div>
        <div className="no-gpu-card">
          <div className="empty-state">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" />
              <line x1="9" y1="2" x2="9" y2="4" />
              <line x1="15" y1="2" x2="15" y2="4" />
              <line x1="9" y1="20" x2="9" y2="22" />
              <line x1="15" y1="20" x2="15" y2="22" />
            </svg>
            <h3>No GPU Detected</h3>
            <p>
              Make sure GPU drivers are installed and the device is properly
              connected.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>GPU Metrics</h2>
        <p className="page-description">
          {gpus.length} GPU{gpus.length > 1 ? 's' : ''} detected • Real-time
          monitoring
        </p>
      </div>

      <div className="metrics-dashboard">
        {gpus.map((gpu, index) => {
          const { info, current } = gpu;
          const hasThermo =
            current.temperature_celsius !== null ||
            current.fan_speed_percent !== null;
          const hasPower = current.power_usage_watts !== null;
          const hasClocks =
            current.clock_speed_mhz !== null ||
            current.memory_clock_mhz !== null;
          const hasEncoders =
            current.encoder_utilization !== null ||
            current.decoder_utilization !== null;
          const hasPcie =
            current.pcie_throughput_rx_mbps !== null ||
            current.pcie_throughput_tx_mbps !== null;

          return (
            <motion.div
              key={gpu.info.id}
              className="gpu-dashboard-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              {/* GPU Header */}
              <div className="gpu-header">
                <div className="gpu-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <rect x="9" y="9" width="6" height="6" />
                  </svg>
                </div>
                <div className="gpu-info">
                  <h3>{info.name}</h3>
                  <span className="gpu-vendor">
                    {info.vendor} • Driver {info.driver_version}
                    {info.compute_capability &&
                      ` • CC ${info.compute_capability}`}
                  </span>
                </div>
                {info.cuda_cores && (
                  <div className="gpu-badge">
                    {info.cuda_cores.toLocaleString()} CUDA
                  </div>
                )}
              </div>

              {/* Main Metrics Grid */}
              <div className="metrics-grid-main">
                {/* GPU Utilization - Always Show */}
                <div className="metric-card utilization">
                  <div className="metric-card-header">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                    </svg>
                    <span>GPU Utilization</span>
                  </div>
                  <div
                    className="metric-value-large"
                    style={{
                      color: getUtilizationColor(current.gpu_utilization),
                    }}
                  >
                    {current.gpu_utilization.toFixed(0)}%
                  </div>
                  <div className="progress-bar large">
                    <motion.div
                      className="progress-fill"
                      style={{
                        backgroundColor: getUtilizationColor(
                          current.gpu_utilization,
                        ),
                      }}
                      animate={{ width: `${current.gpu_utilization}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                {/* Memory Usage - Always Show */}
                <div className="metric-card memory">
                  <div className="metric-card-header">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="2" y="2" width="20" height="20" rx="2" />
                      <path d="M7 2v20M17 2v20" />
                    </svg>
                    <span>VRAM Usage</span>
                  </div>
                  <div className="metric-value-large">
                    {formatMemory(current.memory_used_mb)}
                    <span className="metric-unit">
                      {' '}
                      / {formatMemory(current.memory_total_mb)}
                    </span>
                  </div>
                  <div className="progress-bar large">
                    <motion.div
                      className="progress-fill memory"
                      animate={{ width: `${current.memory_utilization}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <div className="metric-detail">
                    {current.memory_utilization.toFixed(1)}% used •{' '}
                    {formatMemory(
                      current.memory_total_mb - current.memory_used_mb,
                    )}{' '}
                    free
                  </div>
                </div>

                {/* Temperature & Cooling */}
                {hasThermo && (
                  <div className="metric-card thermal">
                    <div className="metric-card-header">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                      </svg>
                      <span>Thermal</span>
                    </div>
                    <div className="metric-row-grid">
                      {current.temperature_celsius !== null && (
                        <div className="metric-mini">
                          <span className="mini-label">Temperature</span>
                          <span
                            className="mini-value"
                            style={{
                              color: getTemperatureColor(
                                current.temperature_celsius,
                              ),
                            }}
                          >
                            {current.temperature_celsius.toFixed(0)}°C
                          </span>
                        </div>
                      )}
                      {current.fan_speed_percent !== null && (
                        <div className="metric-mini">
                          <span className="mini-label">Fan Speed</span>
                          <span className="mini-value">
                            {current.fan_speed_percent}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Power */}
                {hasPower && (
                  <div className="metric-card power">
                    <div className="metric-card-header">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      <span>Power</span>
                    </div>
                    <div className="metric-row-grid">
                      <div className="metric-mini">
                        <span className="mini-label">Usage</span>
                        <span className="mini-value">
                          {current.power_usage_watts?.toFixed(0)}W
                        </span>
                      </div>
                      {current.power_limit_watts !== null && (
                        <div className="metric-mini">
                          <span className="mini-label">Limit</span>
                          <span className="mini-value">
                            {current.power_limit_watts.toFixed(0)}W
                          </span>
                        </div>
                      )}
                    </div>
                    {current.power_limit_watts !== null &&
                      current.power_usage_watts !== null && (
                        <div className="progress-bar">
                          <motion.div
                            className="progress-fill power"
                            animate={{
                              width: `${(current.power_usage_watts / current.power_limit_watts) * 100}%`,
                            }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      )}
                  </div>
                )}

                {/* Clock Speeds */}
                {hasClocks && (
                  <div className="metric-card clocks">
                    <div className="metric-card-header">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>Clock Speeds</span>
                    </div>
                    <div className="metric-row-grid">
                      {current.clock_speed_mhz !== null && (
                        <div className="metric-mini">
                          <span className="mini-label">GPU Clock</span>
                          <span className="mini-value">
                            {current.clock_speed_mhz} MHz
                          </span>
                        </div>
                      )}
                      {current.memory_clock_mhz !== null && (
                        <div className="metric-mini">
                          <span className="mini-label">Memory Clock</span>
                          <span className="mini-value">
                            {current.memory_clock_mhz} MHz
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Encoder/Decoder */}
                {hasEncoders && (
                  <div className="metric-card encoders">
                    <div className="metric-card-header">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                      </svg>
                      <span>Video Engines</span>
                    </div>
                    <div className="metric-row-grid">
                      {current.encoder_utilization !== null && (
                        <div className="metric-mini">
                          <span className="mini-label">NVENC</span>
                          <span className="mini-value">
                            {current.encoder_utilization}%
                          </span>
                        </div>
                      )}
                      {current.decoder_utilization !== null && (
                        <div className="metric-mini">
                          <span className="mini-label">NVDEC</span>
                          <span className="mini-value">
                            {current.decoder_utilization}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* PCIe Throughput */}
                {hasPcie && (
                  <div className="metric-card pcie">
                    <div className="metric-card-header">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 5v14M5 12h14" />
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                      </svg>
                      <span>PCIe Bandwidth</span>
                    </div>
                    <div className="metric-row-grid">
                      {current.pcie_throughput_rx_mbps !== null && (
                        <div className="metric-mini">
                          <span className="mini-label">↓ RX</span>
                          <span className="mini-value">
                            {formatBytes(
                              current.pcie_throughput_rx_mbps * 1024 * 1024,
                            )}
                            /s
                          </span>
                        </div>
                      )}
                      {current.pcie_throughput_tx_mbps !== null && (
                        <div className="metric-mini">
                          <span className="mini-label">↑ TX</span>
                          <span className="mini-value">
                            {formatBytes(
                              current.pcie_throughput_tx_mbps * 1024 * 1024,
                            )}
                            /s
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* History Sparkline placeholder */}
              {gpu.history && gpu.history.length > 1 && (
                <div className="history-summary">
                  <span className="history-label">
                    {gpu.history.length} samples • Last{' '}
                    {Math.round(
                      (Date.now() - gpu.history[0]?.timestamp) / 1000,
                    )}
                    s
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}

        {/* System-GPU Interaction Summary */}
        {systemMetrics && (
          <motion.div
            className="system-gpu-summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h4>System Resources</h4>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">CPU Usage</span>
                <span className="summary-value">
                  {systemMetrics.cpu_usage.toFixed(1)}%
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">System Memory</span>
                <span className="summary-value">
                  {(systemMetrics.memory_used_mb / 1024).toFixed(1)} GB /{' '}
                  {(systemMetrics.memory_total_mb / 1024).toFixed(0)} GB
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Disk Read</span>
                <span className="summary-value">
                  {formatBytes(systemMetrics.disk_read_bytes_sec)}/s
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Disk Write</span>
                <span className="summary-value">
                  {formatBytes(systemMetrics.disk_write_bytes_sec)}/s
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
