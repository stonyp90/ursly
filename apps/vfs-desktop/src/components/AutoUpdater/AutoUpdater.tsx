/**
 * Auto Updater Component
 * Checks for updates and shows progress during download/install
 */
import { useState, useEffect, useCallback } from 'react';
import './AutoUpdater.css';

// Check if Tauri is available
const isTauriAvailable = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// Lazy load updater plugin to avoid crashes in dev mode
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let updaterModule: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processModule: any = null;
let modulesLoaded = false;

const loadUpdaterModule = async (): Promise<boolean> => {
  if (modulesLoaded) {
    return updaterModule !== null && updaterModule !== false;
  }

  // Check if we're in a Tauri environment first
  if (!isTauriAvailable()) {
    updaterModule = false;
    processModule = false;
    modulesLoaded = true;
    return false;
  }

  // Dynamic import with string concatenation to prevent Vite analysis
  const updaterPath = '@tauri-apps/plugin-updater';
  const processPath = '@tauri-apps/api/process';

  try {
    updaterModule = await import(/* @vite-ignore */ updaterPath);
  } catch (err) {
    console.debug('Updater plugin not available (expected in dev mode):', err);
    updaterModule = false;
    modulesLoaded = true;
    return false;
  }

  try {
    processModule = await import(/* @vite-ignore */ processPath);
  } catch (err) {
    console.debug('Process API not available:', err);
    processModule = false;
  }

  modulesLoaded = true;
  return true;
};

// Type-safe UpdateManifest - only used if module is available
type UpdateManifest = {
  version: string;
  body?: string;
  date?: string;
  [key: string]: unknown;
};

export function AutoUpdater() {
  // Early return if not in Tauri environment
  if (!isTauriAvailable()) {
    return null;
  }

  const [isChecking, setIsChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<UpdateManifest | null>(
    null,
  );
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const checkForUpdates = useCallback(async () => {
    const loaded = await loadUpdaterModule();
    if (!loaded) {
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setError(null);
    try {
      const { shouldUpdate, manifest } = await updaterModule.check();
      if (shouldUpdate && manifest) {
        setUpdateAvailable(manifest);
      } else {
        setUpdateAvailable(null);
      }
    } catch (err) {
      console.debug(
        'Update check failed (expected in dev or if not configured):',
        err,
      );
      setError(null); // Don't show error in dev mode
    } finally {
      setIsChecking(false);
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    if (!updateAvailable || !updaterModule || !processModule) return;
    setIsUpdating(true);
    setError(null);
    try {
      await updaterModule.install();
      await processModule.relaunch();
    } catch (err) {
      console.error('Failed to install update:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to install update.',
      );
      setIsUpdating(false);
    }
  }, [updateAvailable]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let unlistenPromise: Promise<() => void> | null = null;

    loadUpdaterModule().then((loaded) => {
      if (!loaded) {
        setIsChecking(false); // Ensure checking state is cleared
        return; // Plugin not available, skip setup
      }

      checkForUpdates();

      // Check for updates every 6 hours
      interval = setInterval(
        () => {
          checkForUpdates();
        },
        6 * 60 * 60 * 1000,
      );

      unlistenPromise = updaterModule.onUpdaterEvent(
        ({ event, payload }: { event: string; payload: unknown }) => {
          switch (event) {
            case 'UPDATE_AVAILABLE':
              setUpdateAvailable(payload as UpdateManifest);
              break;
            case 'DOWNLOAD_PROGRESS': {
              const progress = payload as {
                chunkLength: number;
                contentLength: number;
              };
              setDownloadProgress(
                progress.contentLength > 0
                  ? (progress.chunkLength / progress.contentLength) * 100
                  : 0,
              );
              setDownloadedBytes(progress.chunkLength);
              setTotalBytes(progress.contentLength);
              break;
            }
            case 'DOWNLOAD_FINISHED': {
              const finished = payload as { contentLength: number };
              setDownloadProgress(100);
              setDownloadedBytes(finished.contentLength);
              setTotalBytes(finished.contentLength);
              break;
            }
            case 'INSTALL_PROGRESS':
              // Not typically used for Tauri, install is fast
              break;
            case 'UPDATE_INSTALLED':
              if (processModule) {
                processModule.relaunch();
              }
              break;
            case 'ERROR':
              setError(payload as string);
              setIsUpdating(false);
              break;
          }
        },
      );
    });

    return () => {
      if (interval) {
        clearInterval(interval);
      }
      if (unlistenPromise) {
        unlistenPromise.then((f) => f());
      }
    };
  }, [checkForUpdates]);

  if (isChecking) {
    return null; // Don't show anything while checking
  }

  if (error && !isUpdating) {
    return null; // Don't show errors unless updating
  }

  if (isUpdating) {
    const progressText =
      totalBytes > 0
        ? `${(downloadedBytes / (1024 * 1024)).toFixed(1)}MB / ${(totalBytes / (1024 * 1024)).toFixed(1)}MB`
        : `${downloadProgress.toFixed(0)}%`;
    return (
      <div className="auto-updater-overlay">
        <div className="auto-updater-modal">
          <div className="auto-updater-header">
            <div className="auto-updater-spinner" />
            <h3>Updating Ursly VFS</h3>
          </div>
          <p className="auto-updater-message">
            Downloading update... Please don't close the app.
          </p>
          <div className="auto-updater-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <div className="progress-text">{progressText}</div>
            <div className="progress-percent">
              {Math.round(downloadProgress)}%
            </div>
          </div>
          {error && (
            <div className="auto-updater-error">
              <p>{error}</p>
              <button onClick={() => setIsUpdating(false)}>Close</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (updateAvailable) {
    return (
      <div className="auto-updater-overlay">
        <div className="auto-updater-modal">
          <div className="auto-updater-header">
            <h3>Update Available</h3>
          </div>
          <div className="auto-updater-info">
            <p>
              <strong>Version {updateAvailable.version}</strong>
            </p>
            {updateAvailable.body && <p>{updateAvailable.body}</p>}
          </div>
          <div className="auto-updater-actions">
            <button
              className="btn-primary"
              onClick={applyUpdate}
              disabled={isChecking}
            >
              Install & Relaunch
            </button>
            <button
              className="btn-secondary"
              onClick={() => setUpdateAvailable(null)}
              disabled={isChecking}
            >
              Later
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
