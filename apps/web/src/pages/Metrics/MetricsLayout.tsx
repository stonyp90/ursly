import { NavLink, Outlet } from 'react-router-dom';
import { MetricsProvider, useMetrics } from './MetricsContext';
import styles from './Metrics.module.css';

const tabs = [
  {
    path: '/metrics/gpu',
    label: 'GPU Metrics',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        <line x1="9" y1="2" x2="9" y2="4" />
        <line x1="15" y1="2" x2="15" y2="4" />
      </svg>
    ),
  },
  {
    path: '/metrics/timeline',
    label: 'Performance Timeline',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    path: '/metrics/system',
    label: 'System Resources',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
];

function MetricsHeader() {
  const { systemInfo, isDesktopApp } = useMetrics();

  return (
    <div className={styles.header}>
      <div>
        <h1>Metrics</h1>
        <p className={styles.subtitle}>Real-time monitoring of your system performance</p>
      </div>
      {isDesktopApp && systemInfo && (
        <div className={styles.headerInfo}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Host</span>
            <span className={styles.infoValue}>{systemInfo.hostname}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>OS</span>
            <span className={styles.infoValue}>{systemInfo.os_name} {systemInfo.os_version}</span>
          </div>
          <div className={styles.statusIndicator}>
            <span className={styles.statusDot}></span>
            <span>Connected</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricsTabs() {
  return (
    <nav className={styles.tabNav}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) => `${styles.tabBtn} ${isActive ? styles.active : ''}`}
        >
          <span className={styles.tabIcon}>{tab.icon}</span>
          <span className={styles.tabLabel}>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function MetricsContent() {
  const { isLoading, error, isDesktopApp } = useMetrics();

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loaderRing}></div>
        <span>Detecting hardware...</span>
      </div>
    );
  }

  if (error || !isDesktopApp) {
    return (
      <div className={styles.errorCard}>
        <div className={styles.errorIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <h2>Desktop App Required</h2>
        <p>System metrics monitoring requires the Ursly.io desktop application.</p>
        <p className={styles.errorHint}>
          Download the desktop app to access real-time GPU metrics, temperature monitoring, and power consumption data.
        </p>
      </div>
    );
  }

  return <Outlet />;
}

export function MetricsLayout() {
  return (
    <MetricsProvider>
      <div className={styles.container}>
        <MetricsHeader />
        <MetricsTabs />
        <div className={styles.content}>
          <MetricsContent />
        </div>
      </div>
    </MetricsProvider>
  );
}


