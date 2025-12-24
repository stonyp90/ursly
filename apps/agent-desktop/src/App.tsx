import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Header } from './components/Header';
import { GpuMetricsPage } from './pages/GpuMetricsPage';
import { PerformanceTimelinePage } from './pages/PerformanceTimelinePage';
import { SystemResourcesPage } from './pages/SystemResourcesPage';
import { ThemeProvider } from './contexts/ThemeContext';
import { ThemeCustomizer } from './components/ThemeCustomizer';
import { ToastProvider } from './components/Toast';
import { ErrorDialogProvider } from './components/ErrorDialog';
import type { AllMetrics, GpuMetricsEvent, SystemInfo } from './types';

type TabId = 'gpu' | 'timeline' | 'system';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  {
    id: 'gpu',
    label: 'GPU Metrics',
    icon: (
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
      </svg>
    ),
  },
  {
    id: 'timeline',
    label: 'Performance Timeline',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: 'system',
    label: 'System Resources',
    icon: (
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
    ),
  },
];

function App() {
  const [metrics, setMetrics] = useState<AllMetrics | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('gpu');
  const [isThemeCustomizerOpen, setIsThemeCustomizerOpen] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [allMetrics, sysInfo] = await Promise.all([
          invoke<AllMetrics>('get_all_metrics'),
          invoke<SystemInfo>('get_system_info'),
        ]);
        setMetrics(allMetrics);
        setSystemInfo(sysInfo);
        setIsLoading(false);
      } catch (err) {
        setError(String(err));
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    const unlisten = listen<GpuMetricsEvent>('gpu-metrics', (event) => {
      setMetrics((prev) => {
        if (!prev) return prev;
        const updatedGpus = prev.gpus.map((gpu) => {
          if (gpu.info.id === event.payload.gpu_id) {
            return {
              ...gpu,
              current: event.payload.metrics,
              history: [...gpu.history.slice(-119), event.payload.metrics],
            };
          }
          return gpu;
        });
        return { ...prev, gpus: updatedGpus };
      });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const allMetrics = await invoke<AllMetrics>('get_all_metrics');
        setMetrics((prev) => ({
          ...allMetrics,
          gpus: prev?.gpus || allMetrics.gpus,
        }));
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleDevToolsShortcut = async (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const shouldToggle = isMac
        ? e.metaKey && e.altKey && e.key.toLowerCase() === 'i'
        : e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i';

      if (shouldToggle) {
        e.preventDefault();
        try {
          await invoke('toggle_devtools');
        } catch (err) {
          console.error('Failed to toggle devtools:', err);
        }
      }
    };

    window.addEventListener('keydown', handleDevToolsShortcut);
    return () => window.removeEventListener('keydown', handleDevToolsShortcut);
  }, []);

  if (isLoading) {
    return (
      <div className="app loading">
        <div className="loader">
          <div className="loader-ring"></div>
          <span>Detecting GPUs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app error">
        <div className="error-card">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'gpu':
        return (
          <GpuMetricsPage
            gpus={metrics?.gpus || []}
            systemMetrics={metrics?.system}
          />
        );
      case 'timeline':
        return <PerformanceTimelinePage gpus={metrics?.gpus || []} />;
      case 'system':
        return (
          <SystemResourcesPage
            metrics={metrics?.system}
            info={systemInfo}
            processes={metrics?.model_processes || []}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ThemeProvider>
      <ToastProvider>
        <ErrorDialogProvider>
          <div className="app">
            <Header systemInfo={systemInfo} appName="Ursly Agent" />

            <nav className="tab-nav">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="tab-icon">{tab.icon}</span>
                  <span className="tab-label">{tab.label}</span>
                </button>
              ))}

              <button
                className="settings-btn"
                onClick={() => setIsThemeCustomizerOpen(true)}
                title="Customize Appearance"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </nav>

            <main className="main-content">{renderPage()}</main>

            <ThemeCustomizer
              isOpen={isThemeCustomizerOpen}
              onClose={() => setIsThemeCustomizerOpen(false)}
            />
          </div>
        </ErrorDialogProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
