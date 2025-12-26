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

function formatBytesCompact(bytes: number): string {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0';
  if (!isFinite(bytes)) return '0';
  const k = 1024;
  const sizes = ['B', 'K', 'M', 'G'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  return parseFloat((bytes / Math.pow(k, i)).toFixed(0)) + sizes[i];
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatBytes(bytes: number): string {
  if (!bytes || isNaN(bytes) || bytes === 0) return '0 B';
  if (!isFinite(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function safeNumber(val: number | undefined | null, fallback = 0): number {
  if (val === undefined || val === null || isNaN(val) || !isFinite(val)) {
    return fallback;
  }
  return val;
}

function getStatusClass(value: number, warn = 70, crit = 90): string {
  const v = safeNumber(value);
  if (v >= crit) return 'critical';
  if (v >= warn) return 'warning';
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
  const cpuUsage = safeNumber(sys.cpu_usage);
  const memPercent = safeNumber(sys.memory_usage_percent);
  const netRx = safeNumber(sys.network_rx_bytes_sec);
  const netTx = safeNumber(sys.network_tx_bytes_sec);
  const diskRead = safeNumber(sys.disk_read_bytes_sec);
  const diskWrite = safeNumber(sys.disk_write_bytes_sec);
  const diskTotal = diskRead + diskWrite;

  const gpuUsage = gpu ? safeNumber(gpu.gpu_utilization) : 0;

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
          {/* 2x3 Grid (6 tiles) */}
          <div className="metrics-grid-6">
            {/* CPU */}
            <div className={`metric-tile ${getStatusClass(cpuUsage)}`}>
              <div className="tile-icon">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5 0a.5.5 0 0 1 .5.5V2h1V.5a.5.5 0 0 1 1 0V2h1V.5a.5.5 0 0 1 1 0V2h1V.5a.5.5 0 0 1 1 0V2A2.5 2.5 0 0 1 14 4.5h1.5a.5.5 0 0 1 0 1H14v1h1.5a.5.5 0 0 1 0 1H14v1h1.5a.5.5 0 0 1 0 1H14v1h1.5a.5.5 0 0 1 0 1H14a2.5 2.5 0 0 1-2.5 2.5v1.5a.5.5 0 0 1-1 0V14h-1v1.5a.5.5 0 0 1-1 0V14h-1v1.5a.5.5 0 0 1-1 0V14h-1v1.5a.5.5 0 0 1-1 0V14A2.5 2.5 0 0 1 2 11.5H.5a.5.5 0 0 1 0-1H2v-1H.5a.5.5 0 0 1 0-1H2v-1H.5a.5.5 0 0 1 0-1H2v-1H.5a.5.5 0 0 1 0-1H2A2.5 2.5 0 0 1 4.5 2V.5A.5.5 0 0 1 5 0zm-.5 3A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13h7a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 11.5 3h-7zM5 6.5A1.5 1.5 0 0 1 6.5 5h3A1.5 1.5 0 0 1 11 6.5v3A1.5 1.5 0 0 1 9.5 11h-3A1.5 1.5 0 0 1 5 9.5v-3zM6.5 6a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3z" />
                </svg>
              </div>
              <div className="tile-value">{cpuUsage.toFixed(0)}%</div>
              <div className="tile-label">CPU</div>
            </div>

            {/* RAM */}
            <div className={`metric-tile ${getStatusClass(memPercent)}`}>
              <div className="tile-icon">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M0 3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3zm5.5 4a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5H6v1.5a.5.5 0 0 0 1 0V9h.5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5H7V5.5a.5.5 0 0 0-1 0V7h-.5z" />
                </svg>
              </div>
              <div className="tile-value">{memPercent.toFixed(0)}%</div>
              <div className="tile-label">RAM</div>
            </div>

            {/* GPU */}
            <div
              className={`metric-tile gpu ${gpu ? getStatusClass(gpuUsage) : 'inactive'}`}
            >
              <div className="tile-icon">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 8a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm7.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
                  <path d="M0 1.5A.5.5 0 0 1 .5 1h1a.5.5 0 0 1 .5.5V4h13.5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H2v2.5a.5.5 0 0 1-1 0V2H.5a.5.5 0 0 1-.5-.5Zm5.5 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM9 8a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z" />
                </svg>
              </div>
              <div className="tile-value">
                {gpu ? `${gpuUsage.toFixed(0)}%` : 'N/A'}
              </div>
              <div className="tile-label">GPU</div>
            </div>

            {/* Disk I/O */}
            <div className="metric-tile disk">
              <div className="tile-icon">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.5 11a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM3 10.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" />
                  <path d="M16 11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V9.51c0-.418.105-.83.305-1.197l2.472-4.531A1.5 1.5 0 0 1 4.094 3h7.812a1.5 1.5 0 0 1 1.317.782l2.472 4.53c.2.368.305.78.305 1.198V11zM3.655 4.26 1.592 8.043C1.724 8.014 1.86 8 2 8h12c.14 0 .276.014.408.042L12.345 4.26a.5.5 0 0 0-.439-.26H4.094a.5.5 0 0 0-.44.26zM1 10v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1z" />
                </svg>
              </div>
              <div className="tile-value">
                {formatBytesCompact(diskTotal)}/s
              </div>
              <div className="tile-label">DISK</div>
            </div>

            {/* Net Upload */}
            <div className="metric-tile upload">
              <div className="tile-icon">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"
                  />
                  <path
                    d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1Z"
                    transform="rotate(180 8 8)"
                  />
                </svg>
              </div>
              <div className="tile-value">{formatBytesCompact(netTx)}/s</div>
              <div className="tile-label">↑ UP</div>
            </div>

            {/* Net Download */}
            <div className="metric-tile download">
              <div className="tile-icon">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1Z" />
                </svg>
              </div>
              <div className="tile-value">{formatBytesCompact(netRx)}/s</div>
              <div className="tile-label">↓ DOWN</div>
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
