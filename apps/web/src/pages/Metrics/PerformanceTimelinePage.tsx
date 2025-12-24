import { useMetrics } from './MetricsContext';
import { MetricsChart } from '../GpuMetrics/MetricsChart';
import styles from './Metrics.module.css';

export function PerformanceTimelinePage() {
  const { metrics, systemInfo } = useMetrics();
  const gpus = metrics?.gpus || [];

  // Calculate stats from history
  const getHistoryStats = (gpu: (typeof gpus)[0]) => {
    if (!gpu.history.length)
      return { avgUtil: 0, maxUtil: 0, avgTemp: 0, maxTemp: 0 };

    const avgUtil =
      gpu.history.reduce((sum, h) => sum + h.gpu_utilization, 0) /
      gpu.history.length;
    const maxUtil = Math.max(...gpu.history.map((h) => h.gpu_utilization));
    const avgTemp =
      gpu.history.reduce((sum, h) => sum + (h.temperature_celsius || 0), 0) /
      gpu.history.length;
    const maxTemp = Math.max(
      ...gpu.history.map((h) => h.temperature_celsius || 0),
    );

    return { avgUtil, maxUtil, avgTemp, maxTemp };
  };

  return (
    <div className={styles.pageContent}>
      <div className={styles.pageHeader}>
        <h2>Performance Timeline</h2>
        <p>
          Historical view of GPU utilization, memory usage, temperature, and
          power over time
        </p>
      </div>

      {/* Timeline Stats Summary */}
      {gpus.length > 0 && (
        <div className={styles.summaryGrid}>
          {gpus.map((gpu) => {
            const stats = getHistoryStats(gpu);
            return (
              <div
                key={gpu.info.id}
                className={styles.summaryCard}
                style={{ minWidth: '200px' }}
              >
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
                  <span className={styles.summaryLabel}>{gpu.info.name}</span>
                  <div className={styles.summaryStats}>
                    <span className={styles.summaryMini}>
                      Avg: {stats.avgUtil.toFixed(0)}%
                    </span>
                    <span className={styles.summaryMini}>
                      Peak: {stats.maxUtil.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

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
              <span className={styles.summaryLabel}>Data Points</span>
              <span className={styles.summaryValue}>
                {gpus[0]?.history.length || 0} / 120
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
              <span className={styles.summaryLabel}>Refresh Rate</span>
              <span className={styles.summaryValue}>2s</span>
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
              <span className={styles.summaryLabel}>Host</span>
              <span
                className={styles.summaryValue}
                style={{ fontSize: '12px' }}
              >
                {systemInfo?.hostname || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className={styles.chartsGrid}>
        {gpus.map((gpu) => (
          <MetricsChart key={gpu.info.id} gpu={gpu} />
        ))}

        {gpus.length === 0 && (
          <div className={styles.emptyState}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <h3>No Data Available</h3>
            <p>Performance data will appear here once a GPU is detected.</p>
          </div>
        )}
      </div>
    </div>
  );
}
