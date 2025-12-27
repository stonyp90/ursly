import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Header } from './components/Header';
import { FinderPage } from './pages/FinderPage';
import { MetricsPage } from './pages/MetricsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/Toast';
import { ErrorDialogProvider } from './components/ErrorDialog';
import { BottomToolbar } from './components/BottomToolbar';
import { AutoUpdater } from './components/AutoUpdater';
import { OnboardingTour } from './components/OnboardingTour';
import { createGlobalDragHandler } from './utils/dragDropEnhancements';

export type AppTab = 'files' | 'metrics' | 'settings';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('files');
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const initVfs = async () => {
      try {
        // Add timeout to prevent hanging - but don't fail if it times out
        const initPromise = invoke('vfs_init');
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => {
            console.warn(
              'VFS initialization taking longer than expected, continuing anyway...',
            );
            resolve(null);
          }, 5000),
        );

        await Promise.race([initPromise, timeoutPromise]);
        setIsLoading(false);
      } catch (err) {
        console.error('VFS initialization error:', err);
        // Don't block the app if initialization fails - allow user to continue
        setError(null);
        setIsLoading(false);
      }
    };

    // Start initialization but don't block
    initVfs();

    // Initialize global drag and drop enhancements
    createGlobalDragHandler();

    // Fallback: ensure loading state clears after max time
    const fallbackTimeout = setTimeout(() => {
      console.warn('Forcing app to load after timeout');
      setIsLoading(false);
    }, 10000);

    return () => clearTimeout(fallbackTimeout);
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
          <div className="loader-container">
            <div className="loader-ring loader-ring-outer"></div>
            <div className="loader-ring loader-ring-middle"></div>
            <div className="loader-ring loader-ring-inner"></div>
            <div className="loader-core"></div>
          </div>
          <div className="loader-text">
            <span className="loader-text-main">
              Initializing Virtual File System
            </span>
            <span className="loader-text-dots">
              <span className="dot">.</span>
              <span className="dot">.</span>
              <span className="dot">.</span>
            </span>
          </div>
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

  return (
    <ThemeProvider>
      <ToastProvider>
        <ErrorDialogProvider>
          <div className="app">
            <Header activeTab={activeTab} onTabChange={setActiveTab} />

            <main className="main-content full-height">
              {activeTab === 'files' && (
                <FinderPage
                  onOpenMetrics={() => setActiveTab('metrics')}
                  onOpenSearch={() => setIsSearchOpen(true)}
                  isSearchOpen={isSearchOpen}
                  onCloseSearch={() => setIsSearchOpen(false)}
                />
              )}
              {activeTab === 'metrics' && <MetricsPage />}
              {activeTab === 'settings' && (
                <SettingsPage onClose={() => setActiveTab('files')} />
              )}
            </main>

            <BottomToolbar
              onOpenShortcuts={() => setIsShortcutsOpen(true)}
              onOpenSearch={() => {
                // Switch to Files tab if on Metrics tab
                if (activeTab !== 'files') {
                  setActiveTab('files');
                }
                setIsSearchOpen(true);
              }}
              isShortcutsOpen={isShortcutsOpen}
              onCloseShortcuts={() => setIsShortcutsOpen(false)}
            />

            <AutoUpdater />

            <OnboardingTour
              autoStart={true}
              onComplete={() => {
                // Navigate to files tab (main FS page) when tour completes
                setActiveTab('files');
              }}
            />
          </div>
        </ErrorDialogProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
