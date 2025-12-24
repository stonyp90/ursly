import { useMetrics } from './MetricsContext';
import { SystemCard } from '../GpuMetrics/SystemCard';
import styles from './Metrics.module.css';

export function SystemResourcesPage() {
  const { metrics, systemInfo, processes } = useMetrics();

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getCpuColor = (usage: number) => {
    if (usage < 50) return 'var(--success)';
    if (usage < 80) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div className={styles.pageContent}>
      <div className={styles.pageHeader}>
        <h2>System Resources</h2>
        <p>CPU, memory, network, disk I/O, and process monitoring</p>
      </div>

      {/* Summary Stats */}
      {metrics?.system && systemInfo && (
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </div>
            <div className={styles.summaryContent}>
              <span className={styles.summaryLabel}>CPU Usage</span>
              <span
                className={styles.summaryValue}
                style={{ color: getCpuColor(metrics.system.cpu_usage) }}
              >
                {metrics.system.cpu_usage.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="2" width="20" height="20" rx="2" />
                <path d="M7 2v20M17 2v20" />
              </svg>
            </div>
            <div className={styles.summaryContent}>
              <span className={styles.summaryLabel}>Memory</span>
              <span className={styles.summaryValue}>
                {metrics.system.memory_usage_percent.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div className={styles.summaryContent}>
              <span className={styles.summaryLabel}>Load Avg</span>
              <span className={styles.summaryValue}>
                {metrics.system.load_average[0].toFixed(2)}
              </span>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>
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
            </div>
            <div className={styles.summaryContent}>
              <span className={styles.summaryLabel}>Disk Read</span>
              <span className={styles.summaryValue}>
                {formatBytes(metrics.system.disk_read_bytes_sec)}/s
              </span>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <div className={styles.summaryContent}>
              <span className={styles.summaryLabel}>Network RX</span>
              <span className={styles.summaryValue}>
                {formatBytes(metrics.system.network_rx_bytes_sec)}/s
              </span>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className={styles.summaryContent}>
              <span className={styles.summaryLabel}>Uptime</span>
              <span className={styles.summaryValue}>
                {formatUptime(metrics.system.uptime_seconds)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className={styles.systemGrid}>
        <div className={styles.systemMain}>
          <SystemCard metrics={metrics?.system} info={systemInfo} />
        </div>

        {/* CPU Cores Detailed View */}
        {metrics?.system && (
          <div className={styles.processesCard}>
            <div className={styles.cardHeader}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
              </svg>
              <h3>CPU Cores ({systemInfo?.cpu_cores || 0})</h3>
            </div>
            <div className={styles.cpuCoresDetailed}>
              {metrics.system.per_core_usage.map((usage, i) => (
                <div key={i} className={styles.coreItem}>
                  <span className={styles.coreLabel}>Core {i}</span>
                  <div className={styles.coreProgress}>
                    <div
                      className={styles.coreProgressFill}
                      style={{
                        width: `${usage}%`,
                        backgroundColor: getCpuColor(usage),
                      }}
                    />
                  </div>
                  <span
                    className={styles.coreValue}
                    style={{ color: getCpuColor(usage) }}
                  >
                    {usage.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {processes.length > 0 && (
          <div className={styles.processesCard}>
            <div className={styles.cardHeader}>
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
              <h3>AI/ML Processes ({processes.length})</h3>
            </div>
            <div className={styles.processList}>
              {processes.map((process) => (
                <div key={process.pid} className={styles.processItem}>
                  <div className={styles.processInfo}>
                    <span className={styles.processName}>{process.name}</span>
                    <span className={styles.processPid}>
                      PID: {process.pid}
                    </span>
                  </div>
                  <div className={styles.processStats}>
                    <div className={styles.stat}>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                      </svg>
                      <span>{process.cpu_usage.toFixed(1)}%</span>
                    </div>
                    <div className={styles.stat}>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="2" y="2" width="20" height="20" rx="2" />
                        <path d="M7 2v20M17 2v20" />
                      </svg>
                      <span>
                        {formatBytes(process.memory_mb * 1024 * 1024)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disk I/O Card */}
        {metrics?.system && (
          <div className={styles.ioCard}>
            <div className={styles.cardHeader}>
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
              <h3>Disk I/O</h3>
            </div>
            <div className={styles.ioStats}>
              <div className={styles.ioItem}>
                <div className={styles.ioLabel}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  <span>Read</span>
                </div>
                <span className={styles.ioValue}>
                  {formatBytes(metrics.system.disk_read_bytes_sec)}/s
                </span>
              </div>
              <div className={styles.ioItem}>
                <div className={styles.ioLabel}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                  <span>Write</span>
                </div>
                <span className={styles.ioValue}>
                  {formatBytes(metrics.system.disk_write_bytes_sec)}/s
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Network I/O Card */}
        {metrics?.system && (
          <div className={styles.ioCard}>
            <div className={styles.cardHeader}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              <h3>Network I/O</h3>
            </div>
            <div className={styles.ioStats}>
              <div className={styles.ioItem}>
                <div className={styles.ioLabel}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  <span>RX</span>
                </div>
                <span className={styles.ioValue}>
                  {formatBytes(metrics.system.network_rx_bytes_sec)}/s
                </span>
              </div>
              <div className={styles.ioItem}>
                <div className={styles.ioLabel}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                  <span>TX</span>
                </div>
                <span className={styles.ioValue}>
                  {formatBytes(metrics.system.network_tx_bytes_sec)}/s
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Memory Details Card */}
        {metrics?.system && (
          <div className={styles.ioCard}>
            <div className={styles.cardHeader}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="2" width="20" height="20" rx="2" />
                <path d="M7 2v20M17 2v20" />
              </svg>
              <h3>Memory Details</h3>
            </div>
            <div className={styles.ioStats}>
              <div className={styles.ioItem}>
                <div className={styles.ioLabel}>
                  <span>Used</span>
                </div>
                <span className={styles.ioValue}>
                  {(metrics.system.memory_used_mb / 1024).toFixed(1)} GB
                </span>
              </div>
              <div className={styles.ioItem}>
                <div className={styles.ioLabel}>
                  <span>Total</span>
                </div>
                <span className={styles.ioValue}>
                  {(metrics.system.memory_total_mb / 1024).toFixed(1)} GB
                </span>
              </div>
              {metrics.system.swap_total_mb > 0 && (
                <>
                  <div className={styles.ioItem}>
                    <div className={styles.ioLabel}>
                      <span>Swap Used</span>
                    </div>
                    <span className={styles.ioValue}>
                      {(metrics.system.swap_used_mb / 1024).toFixed(1)} GB
                    </span>
                  </div>
                  <div className={styles.ioItem}>
                    <div className={styles.ioLabel}>
                      <span>Swap Total</span>
                    </div>
                    <span className={styles.ioValue}>
                      {(metrics.system.swap_total_mb / 1024).toFixed(1)} GB
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* System Info Card */}
        {systemInfo && (
          <div className={styles.ioCard}>
            <div className={styles.cardHeader}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="8" />
              </svg>
              <h3>System Info</h3>
            </div>
            <div className={styles.ioStats}>
              <div className={styles.ioItem}>
                <div className={styles.ioLabel}>
                  <span>Hostname</span>
                </div>
                <span className={styles.ioValue}>{systemInfo.hostname}</span>
              </div>
              <div className={styles.ioItem}>
                <div className={styles.ioLabel}>
                  <span>OS</span>
                </div>
                <span className={styles.ioValue}>
                  {systemInfo.os_name} {systemInfo.os_version}
                </span>
              </div>
              <div className={styles.ioItem}>
                <div className={styles.ioLabel}>
                  <span>Kernel</span>
                </div>
                <span className={styles.ioValue}>
                  {systemInfo.kernel_version}
                </span>
              </div>
              <div className={styles.ioItem}>
                <div className={styles.ioLabel}>
                  <span>CPU</span>
                </div>
                <span className={styles.ioValue} style={{ fontSize: '11px' }}>
                  {systemInfo.cpu_brand}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
