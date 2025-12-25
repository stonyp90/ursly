import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Header } from './components/Header';
import { FinderPage } from './pages/FinderPage';
import { MetricsPage } from './pages/MetricsPage';
import { ThemeProvider } from './contexts/ThemeContext';
import { ThemeCustomizer } from './components/ThemeCustomizer';
import { ToastProvider } from './components/Toast';
import { ErrorDialogProvider } from './components/ErrorDialog';
import { BottomToolbar } from './components/BottomToolbar';
import { AutoUpdater } from './components/AutoUpdater';

export type AppTab = 'files' | 'metrics';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('files');
  const [isThemeCustomizerOpen, setIsThemeCustomizerOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const initVfs = async () => {
      try {
        await invoke('vfs_init');
        setIsLoading(false);
      } catch (err) {
        // VFS init can fail gracefully - the app still works
        console.warn('VFS init warning:', err);
        setError(null); // Clear any previous error - VFS init failure is non-fatal
        setIsLoading(false);
      }
    };

    initVfs();
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
          <span>Initializing Virtual File System...</span>
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
            </main>

            <BottomToolbar
              onOpenSettings={() => setIsThemeCustomizerOpen(true)}
              onOpenShortcuts={() => setIsShortcutsOpen(true)}
              onOpenSearch={() => setIsSearchOpen(true)}
              isShortcutsOpen={isShortcutsOpen}
              onCloseShortcuts={() => setIsShortcutsOpen(false)}
            />

            <ThemeCustomizer
              isOpen={isThemeCustomizerOpen}
              onClose={() => setIsThemeCustomizerOpen(false)}
            />

            <AutoUpdater />
          </div>
        </ErrorDialogProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
