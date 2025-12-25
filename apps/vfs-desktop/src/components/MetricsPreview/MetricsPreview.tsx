/**
 * MetricsPreview - Compact metrics display for sidebar
 * Shows key system metrics (CPU, GPU, Network) with click to open full metrics
 */
import { useState, useEffect, useCallback } from 'react';
import { invoke as invokeTauri } from '@tauri-apps/api/core';
import { isTauriAvailable } from '../../hooks';
import './MetricsPreview.css';

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

interface GpuMetrics {
  gpu_utilization: number;
  memory_used_mb: number;
  memory_total_mb: number;
  temperature_celsius?: number | null;
}

interface GpuWithMetrics {
  info: { name: string };
  current: GpuMetrics | null;
}

interface AllMetrics {
  gpus: GpuWithMetrics[];
  system: SystemMetrics;
}

interface MetricsPreviewProps {
  onOpenMetrics: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getStatusClass(value: number, warn = 70, crit = 90): string {
  if (value >= crit) return 'critical';
  if (value >= warn) return 'warning';
  return 'good';
}

export function MetricsPreview({ onOpenMetrics }: MetricsPreviewProps) {
  const [metrics, setMetrics] = useState<AllMetrics | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const fetchMetrics = useCallback(async () => {
    if (!isTauriAvailable()) return;
    try {
      const m = await invokeTauri<AllMetrics>('get_all_metrics');
      setMetrics(m);
    } catch (err) {
      console.debug('Metrics fetch failed:', err);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000); // Update every 3s
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (!isTauriAvailable() || !metrics) {
    return null;
  }

  const gpu = metrics.gpus[0]?.current;
  const sys = metrics.system;
  const memPercent = sys.memory_usage_percent || 0;
  const netTotal = sys.network_rx_bytes_sec + sys.network_tx_bytes_sec;

  return (
    <div className="metrics-preview">
      <button
        className="metrics-preview-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="metrics-preview-title">
          <svg viewBox="0 0 16 16" fill="currentColor" className="metrics-icon">
            <path d="M0 0h1v15h15v1H0V0Zm14.817 3.113a.5.5 0 0 1 .07.704l-4.5 5.5a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61 4.15-5.073a.5.5 0 0 1 .704-.07Z" />
          </svg>
          System
        </span>
        <span className={`metrics-chevron ${isExpanded ? 'expanded' : ''}`}>
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
          </svg>
        </span>
      </button>

      {isExpanded && (
        <div className="metrics-preview-content">
          {/* CPU */}
          <div className="metric-row">
            <div className="metric-info">
              <span className="metric-label">CPU</span>
              <span className={`metric-value ${getStatusClass(sys.cpu_usage)}`}>
                {sys.cpu_usage.toFixed(0)}%
              </span>
            </div>
            <div className="metric-bar">
              <div
                className={`metric-bar-fill ${getStatusClass(sys.cpu_usage)}`}
                style={{ width: `${Math.min(sys.cpu_usage, 100)}%` }}
              />
            </div>
          </div>

          {/* Memory */}
          <div className="metric-row">
            <div className="metric-info">
              <span className="metric-label">RAM</span>
              <span className={`metric-value ${getStatusClass(memPercent)}`}>
                {memPercent.toFixed(0)}%
              </span>
            </div>
            <div className="metric-bar">
              <div
                className={`metric-bar-fill ${getStatusClass(memPercent)}`}
                style={{ width: `${Math.min(memPercent, 100)}%` }}
              />
            </div>
          </div>

          {/* GPU (if available) */}
          {gpu && (
            <div className="metric-row">
              <div className="metric-info">
                <span className="metric-label">GPU</span>
                <span
                  className={`metric-value ${getStatusClass(gpu.gpu_utilization)}`}
                >
                  {gpu.gpu_utilization.toFixed(0)}%
                </span>
              </div>
              <div className="metric-bar">
                <div
                  className={`metric-bar-fill gpu ${getStatusClass(gpu.gpu_utilization)}`}
                  style={{ width: `${Math.min(gpu.gpu_utilization, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Network */}
          <div className="metric-row">
            <div className="metric-info">
              <span className="metric-label">Net</span>
              <span className="metric-value network">
                {formatBytes(netTotal)}/s
              </span>
            </div>
            <div className="network-detail">
              <span className="net-up">
                ↑ {formatBytes(sys.network_tx_bytes_sec)}
              </span>
              <span className="net-down">
                ↓ {formatBytes(sys.network_rx_bytes_sec)}
              </span>
            </div>
          </div>

          {/* Open Full Metrics */}
          <button className="open-metrics-btn" onClick={onOpenMetrics}>
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z" />
              <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z" />
            </svg>
            Open Metrics
          </button>
        </div>
      )}
    </div>
  );
}

export default MetricsPreview;
