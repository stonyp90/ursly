import { useMetrics } from './MetricsContext';
import { GpuCard } from '../GpuMetrics/GpuCard';
import styles from './Metrics.module.css';

export function GpuMetricsPage() {
  const { metrics, systemInfo } = useMetrics();
  const gpus = metrics?.gpus || [];

  // Calculate aggregate GPU stats
  const totalGpuMemory = gpus.reduce(
    (sum, gpu) => sum + gpu.info.memory_total_mb,
    0,
  );
  const usedGpuMemory = gpus.reduce(
    (sum, gpu) => sum + gpu.current.memory_used_mb,
    0,
  );
  const avgGpuUtil =
    gpus.length > 0
      ? gpus.reduce((sum, gpu) => sum + gpu.current.gpu_utilization, 0) /
        gpus.length
      : 0;
  const totalPower = gpus.reduce(
    (sum, gpu) => sum + (gpu.current.power_usage_watts || 0),
    0,
  );
  const maxTemp = Math.max(
    ...gpus.map((gpu) => gpu.current.temperature_celsius || 0),
  );

  return (
    <div className={styles.pageContent}>
      <div className={styles.pageHeader}>
        <h2>GPU Metrics</h2>
        <p>
          Real-time monitoring of GPU utilization, memory, temperature, and
          power consumption
        </p>
      </div>

      {/* Summary Cards */}
      {gpus.length > 0 && (
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
                <rect x="9" y="9" width="6" height="6" />
              </svg>
            </div>
            <div className={styles.summaryContent}>
              <span className={styles.summaryLabel}>GPU Count</span>
              <span className={styles.summaryValue}>{gpus.length}</span>
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
                <path d="M18 20V10" />
                <path d="M12 20V4" />
                <path d="M6 20v-6" />
              </svg>
            </div>
            <div className={styles.summaryContent}>
              <span className={styles.summaryLabel}>Avg Utilization</span>
              <span
                className={styles.summaryValue}
                style={{
                  color: avgGpuUtil > 80 ? 'var(--warning)' : 'var(--success)',
                }}
              >
                {avgGpuUtil.toFixed(1)}%
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
              <span className={styles.summaryLabel}>VRAM Usage</span>
              <span className={styles.summaryValue}>
                {(usedGpuMemory / 1024).toFixed(1)} /{' '}
                {(totalGpuMemory / 1024).toFixed(1)} GB
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
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div className={styles.summaryContent}>
              <span className={styles.summaryLabel}>Max Temp</span>
              <span
                className={styles.summaryValue}
                style={{
                  color:
                    maxTemp > 80
                      ? 'var(--error)'
                      : maxTemp > 60
                        ? 'var(--warning)'
                        : 'var(--success)',
                }}
              >
                {maxTemp}°C
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
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div className={styles.summaryContent}>
              <span className={styles.summaryLabel}>Total Power</span>
              <span className={styles.summaryValue}>
                {totalPower.toFixed(0)} W
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
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div className={styles.summaryContent}>
              <span className={styles.summaryLabel}>System</span>
              <span
                className={styles.summaryValue}
                style={{ fontSize: '14px' }}
              >
                {systemInfo?.hostname || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className={styles.gpuGrid}>
        {gpus.map((gpu) => (
          <GpuCard key={gpu.info.id} gpu={gpu} />
        ))}

        {gpus.length === 0 && (
          <div className={styles.emptyState}>
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
        )}
      </div>
    </div>
  );
}
