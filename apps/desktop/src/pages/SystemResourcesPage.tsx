import { motion } from 'framer-motion';
import type { SystemMetrics, SystemInfo, ProcessInfo } from '../types';

interface SystemResourcesPageProps {
  metrics: SystemMetrics | undefined;
  info: SystemInfo | null;
  processes: ProcessInfo[];
}

export function SystemResourcesPage({
  metrics,
  info,
  processes,
}: SystemResourcesPageProps) {
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const getUsageColor = (value: number) => {
    if (value < 50) return 'var(--color-success)';
    if (value < 80) return 'var(--color-warning)';
    return 'var(--color-error)';
  };

  const getLoadColor = (load: number, cores: number) => {
    const ratio = load / cores;
    if (ratio < 0.7) return 'var(--color-success)';
    if (ratio < 1) return 'var(--color-warning)';
    return 'var(--color-error)';
  };

  if (!metrics || !info) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h2>System Resources</h2>
          <p className="page-description">Loading system information...</p>
        </div>
        <div className="loading-card">
          <div className="loader">
            <div className="loader-ring"></div>
            <span>Initializing system metrics...</span>
          </div>
        </div>
      </div>
    );
  }

  const memoryPercent = metrics.memory_usage_percent;
  const swapPercent =
    metrics.swap_total_mb > 0
      ? (metrics.swap_used_mb / metrics.swap_total_mb) * 100
      : 0;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>System Resources</h2>
        <p className="page-description">
          {info.hostname} • {info.os_name} {info.os_version}
        </p>
      </div>

      <div className="system-dashboard">
        {/* System Info Banner */}
        <motion.div
          className="system-info-banner"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="banner-item">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <div>
              <span className="banner-label">Hostname</span>
              <span className="banner-value">{info.hostname}</span>
            </div>
          </div>
          <div className="banner-item">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <div>
              <span className="banner-label">Uptime</span>
              <span className="banner-value">
                {formatUptime(metrics.uptime_seconds)}
              </span>
            </div>
          </div>
          <div className="banner-item">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <div>
              <span className="banner-label">Kernel</span>
              <span className="banner-value">{info.kernel_version}</span>
            </div>
          </div>
        </motion.div>

        {/* Main Metrics Grid */}
        <div className="metrics-grid-system">
          {/* CPU Card */}
          <motion.div
            className="metric-card cpu-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="metric-card-header">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="2" x2="9" y2="4" />
                <line x1="15" y1="2" x2="15" y2="4" />
                <line x1="9" y1="20" x2="9" y2="22" />
                <line x1="15" y1="20" x2="15" y2="22" />
                <line x1="20" y1="9" x2="22" y2="9" />
                <line x1="20" y1="14" x2="22" y2="14" />
                <line x1="2" y1="9" x2="4" y2="9" />
                <line x1="2" y1="14" x2="4" y2="14" />
              </svg>
              <span>CPU</span>
            </div>
            <div className="cpu-info">
              <span className="cpu-name">{info.cpu_brand}</span>
              <span className="cpu-cores">{info.cpu_cores} Cores</span>
            </div>
            <div
              className="metric-value-large"
              style={{ color: getUsageColor(metrics.cpu_usage) }}
            >
              {metrics.cpu_usage.toFixed(1)}%
            </div>
            <div className="progress-bar large">
              <motion.div
                className="progress-fill cpu"
                style={{ backgroundColor: getUsageColor(metrics.cpu_usage) }}
                animate={{ width: `${metrics.cpu_usage}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Per-core usage */}
            <div className="cpu-cores-grid">
              {metrics.per_core_usage.map((usage, i) => (
                <div
                  key={i}
                  className="core-item"
                  title={`Core ${i}: ${usage.toFixed(1)}%`}
                >
                  <div className="core-bar">
                    <div
                      className="core-fill"
                      style={{
                        height: `${usage}%`,
                        backgroundColor: getUsageColor(usage),
                      }}
                    />
                  </div>
                  <span className="core-label">{i}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Memory Card */}
          <motion.div
            className="metric-card memory-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
          >
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
              <span>Memory</span>
            </div>
            <div className="memory-stats">
              <div className="memory-main">
                <div
                  className="metric-value-large"
                  style={{ color: getUsageColor(memoryPercent) }}
                >
                  {(metrics.memory_used_mb / 1024).toFixed(1)} GB
                  <span className="metric-unit">
                    {' '}
                    / {(metrics.memory_total_mb / 1024).toFixed(0)} GB
                  </span>
                </div>
                <div className="progress-bar large">
                  <motion.div
                    className="progress-fill memory"
                    animate={{ width: `${memoryPercent}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className="metric-detail">
                  {memoryPercent.toFixed(1)}% used •{' '}
                  {(
                    (metrics.memory_total_mb - metrics.memory_used_mb) /
                    1024
                  ).toFixed(1)}{' '}
                  GB available
                </div>
              </div>

              {/* Swap */}
              {metrics.swap_total_mb > 0 && (
                <div className="memory-swap">
                  <div className="swap-header">
                    <span className="swap-label">Swap</span>
                    <span className="swap-value">
                      {(metrics.swap_used_mb / 1024).toFixed(2)} GB /{' '}
                      {(metrics.swap_total_mb / 1024).toFixed(1)} GB
                    </span>
                  </div>
                  <div className="progress-bar small">
                    <div
                      className="progress-fill swap"
                      style={{ width: `${swapPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Load Average Card */}
          <motion.div
            className="metric-card load-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="metric-card-header">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 3v18h18" />
                <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
              </svg>
              <span>Load Average</span>
            </div>
            <div className="load-grid">
              <div className="load-item">
                <span className="load-period">1 min</span>
                <span
                  className="load-value"
                  style={{
                    color: getLoadColor(
                      metrics.load_average[0],
                      info.cpu_cores,
                    ),
                  }}
                >
                  {metrics.load_average[0].toFixed(2)}
                </span>
              </div>
              <div className="load-item">
                <span className="load-period">5 min</span>
                <span
                  className="load-value"
                  style={{
                    color: getLoadColor(
                      metrics.load_average[1],
                      info.cpu_cores,
                    ),
                  }}
                >
                  {metrics.load_average[1].toFixed(2)}
                </span>
              </div>
              <div className="load-item">
                <span className="load-period">15 min</span>
                <span
                  className="load-value"
                  style={{
                    color: getLoadColor(
                      metrics.load_average[2],
                      info.cpu_cores,
                    ),
                  }}
                >
                  {metrics.load_average[2].toFixed(2)}
                </span>
              </div>
            </div>
            <div className="load-hint">
              Optimal: &lt; {info.cpu_cores.toFixed(1)} ({info.cpu_cores} cores)
            </div>
          </motion.div>

          {/* Network I/O Card */}
          <motion.div
            className="metric-card network-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
          >
            <div className="metric-card-header">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <span>Network I/O</span>
            </div>
            <div className="io-grid">
              <div className="io-item download">
                <div className="io-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <div className="io-details">
                  <span className="io-label">Download</span>
                  <span className="io-value">
                    {formatBytes(metrics.network_rx_bytes_sec)}/s
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
                    <polyline points="18 15 12 9 6 15" />
                    <line x1="12" y1="9" x2="12" y2="21" />
                  </svg>
                </div>
                <div className="io-details">
                  <span className="io-label">Upload</span>
                  <span className="io-value">
                    {formatBytes(metrics.network_tx_bytes_sec)}/s
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Disk I/O Card */}
          <motion.div
            className="metric-card disk-card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="metric-card-header">
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
              <span>Disk I/O</span>
            </div>
            <div className="io-grid">
              <div className="io-item read">
                <div className="io-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                <div className="io-details">
                  <span className="io-label">Read</span>
                  <span className="io-value">
                    {formatBytes(metrics.disk_read_bytes_sec)}/s
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
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </div>
                <div className="io-details">
                  <span className="io-label">Write</span>
                  <span className="io-value">
                    {formatBytes(metrics.disk_write_bytes_sec)}/s
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Processes Section */}
        {processes.length > 0 && (
          <motion.div
            className="processes-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <div className="section-header">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6" y2="6" />
                <line x1="6" y1="18" x2="6" y2="18" />
              </svg>
              <h3>AI/ML Processes</h3>
              <span className="process-count">{processes.length}</span>
            </div>
            <div className="process-table">
              <div className="process-header-row">
                <span className="col-name">Process</span>
                <span className="col-pid">PID</span>
                <span className="col-cpu">CPU %</span>
                <span className="col-memory">Memory</span>
                <span className="col-status">Status</span>
              </div>
              {processes.map((process) => (
                <motion.div
                  key={process.pid}
                  className="process-row"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <span className="col-name">{process.name}</span>
                  <span className="col-pid">{process.pid}</span>
                  <span
                    className="col-cpu"
                    style={{ color: getUsageColor(process.cpu_usage) }}
                  >
                    {process.cpu_usage.toFixed(1)}%
                  </span>
                  <span className="col-memory">
                    {formatBytes(process.memory_mb * 1024 * 1024)}
                  </span>
                  <span
                    className={`col-status status-${process.status.toLowerCase()}`}
                  >
                    {process.status}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Last Update Timestamp */}
        <div className="metrics-footer">
          <span className="update-indicator">
            <span className="pulse-dot"></span>
            Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}
