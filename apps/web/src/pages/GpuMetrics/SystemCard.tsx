import type { SystemMetrics, SystemInfo } from './types';
import styles from './GpuMetrics.module.css';

interface SystemCardProps {
  metrics: SystemMetrics | undefined;
  info: SystemInfo | null;
}

export function SystemCard({ metrics, info }: SystemCardProps) {
  if (!metrics || !info) return null;

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getCpuColor = (usage: number) => {
    if (usage < 50) return 'var(--success)';
    if (usage < 80) return 'var(--warning)';
    return 'var(--error)';
  };

  const _getMemoryColor = (percent: number) => {
    if (percent < 70) return 'var(--primary)';
    if (percent < 90) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div className={styles.systemCard}>
      <div className={styles.cardHeader}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <h3>System Resources</h3>
      </div>

      {/* System Info Header */}
      <div className={styles.systemInfoHeader}>
        <div className={styles.systemInfoItem}>
          <span className={styles.metricLabel}>CPU</span>
          <span className={styles.metricValue}>{info.cpu_brand}</span>
        </div>
        <div className={styles.systemInfoItem}>
          <span className={styles.metricLabel}>Cores</span>
          <span className={styles.metricValue}>{info.cpu_cores}</span>
        </div>
      </div>

      <div className={styles.systemMetrics}>
        {/* CPU */}
        <div className={styles.systemMetric}>
          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>CPU Usage</span>
            <span className={styles.metricValue} style={{ color: getCpuColor(metrics.cpu_usage) }}>
              {metrics.cpu_usage.toFixed(1)}%
            </span>
          </div>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ 
                width: `${metrics.cpu_usage}%`,
                backgroundColor: getCpuColor(metrics.cpu_usage)
              }}
            />
          </div>
          <div className={styles.cpuCores}>
            {metrics.per_core_usage.slice(0, 14).map((usage, i) => (
              <div key={i} className={styles.coreBar} title={`Core ${i}: ${usage.toFixed(0)}%`}>
                <div 
                  className={styles.coreFill}
                  style={{ 
                    height: `${usage}%`,
                    backgroundColor: getCpuColor(usage)
                  }}
                />
              </div>
            ))}
            {metrics.per_core_usage.length > 14 && (
              <span className={styles.moreCores}>+{metrics.per_core_usage.length - 14}</span>
            )}
          </div>
        </div>

        {/* Memory */}
        <div className={styles.systemMetric}>
          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Memory</span>
            <span className={styles.metricValue}>
              {(metrics.memory_used_mb / 1024).toFixed(1)} / {(metrics.memory_total_mb / 1024).toFixed(1)} GB
            </span>
          </div>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ 
                width: `${metrics.memory_usage_percent}%`,
                background: `linear-gradient(90deg, var(--primary), var(--secondary))`
              }}
            />
          </div>
          <div className={styles.metricSubtext}>
            {metrics.memory_usage_percent.toFixed(1)}% used
          </div>
        </div>

        {/* Swap */}
        {metrics.swap_total_mb > 0 && (
          <div className={`${styles.systemMetric} ${styles.systemMetricSmall}`}>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Swap</span>
              <span className={styles.metricValue}>
                {(metrics.swap_used_mb / 1024).toFixed(1)} / {(metrics.swap_total_mb / 1024).toFixed(1)} GB
              </span>
            </div>
          </div>
        )}

        {/* Disk I/O */}
        <div className={styles.systemMetric}>
          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Disk I/O</span>
          </div>
          <div className={styles.networkStats}>
            <div className={styles.networkItem}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <span>R: {formatBytes(metrics.disk_read_bytes_sec)}/s</span>
            </div>
            <div className={styles.networkItem}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="18 15 12 9 6 15" />
              </svg>
              <span>W: {formatBytes(metrics.disk_write_bytes_sec)}/s</span>
            </div>
          </div>
        </div>

        {/* Network */}
        <div className={styles.systemMetric}>
          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Network</span>
          </div>
          <div className={styles.networkStats}>
            <div className={styles.networkItem}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <span>RX: {formatBytes(metrics.network_rx_bytes_sec)}/s</span>
            </div>
            <div className={styles.networkItem}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="18 15 12 9 6 15" />
              </svg>
              <span>TX: {formatBytes(metrics.network_tx_bytes_sec)}/s</span>
            </div>
          </div>
        </div>

        {/* Load Average */}
        <div className={styles.systemMetric}>
          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Load Average</span>
          </div>
          <div className={styles.loadValues}>
            <span title="1 minute">{metrics.load_average[0].toFixed(2)}</span>
            <span title="5 minutes">{metrics.load_average[1].toFixed(2)}</span>
            <span title="15 minutes">{metrics.load_average[2].toFixed(2)}</span>
          </div>
        </div>

        {/* Uptime */}
        <div className={`${styles.systemMetric} ${styles.systemMetricSmall}`}>
          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Uptime</span>
            <span className={styles.metricValue}>{formatUptime(metrics.uptime_seconds)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
