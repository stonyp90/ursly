/**
 * Auto Updater Component
 * Checks for updates and shows progress during download/install
 */
import { useState, useEffect } from 'react';
import './AutoUpdater.css';

interface UpdateProgress {
  downloaded: number;
  total: number;
  percent: number;
}

export function AutoUpdater() {
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{
    version: string;
    body: string;
  } | null>(null);

  useEffect(() => {
    checkForUpdates();

    // Check for updates every 6 hours
    const interval = setInterval(
      () => {
        checkForUpdates();
      },
      6 * 60 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, []);

  const checkForUpdates = async () => {
    try {
      setIsChecking(true);
      setError(null);

      // Try to import updater plugin
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (update?.available) {
        setUpdateAvailable(true);
        setUpdateInfo({
          version: update.version || 'Unknown',
          body: update.body || 'Update available',
        });
      }
    } catch (err) {
      // Updater plugin might not be available in dev mode or not configured
      console.debug(
        'Update check failed (expected in dev or if not configured):',
        err,
      );
    } finally {
      setIsChecking(false);
    }
  };

  const installUpdate = async () => {
    try {
      setIsUpdating(true);
      setError(null);
      setProgress({ downloaded: 0, total: 0, percent: 0 });

      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (!update?.available) {
        setError('No update available');
        setIsUpdating(false);
        return;
      }

      // Listen to download progress
      const unlisten = await update.onUpdaterEvent((event) => {
        if (event.status === 'PENDING') {
          setProgress({ downloaded: 0, total: 0, percent: 0 });
        } else if (event.status === 'DOWNLOADING') {
          const downloaded = event.chunkLength || 0;
          const total = event.contentLength || 0;
          const percent = total > 0 ? (downloaded / total) * 100 : 0;
          setProgress({ downloaded, total, percent });
        } else if (event.status === 'DONE') {
          setProgress({ downloaded: 100, total: 100, percent: 100 });
        } else if (event.status === 'ERROR') {
          setError(event.error || 'Update failed');
          setIsUpdating(false);
        }
      });

      // Start download and install
      await update.downloadAndInstall();

      // Clean up listener
      await unlisten();

      // Restart app after successful install
      const { exit } = await import('@tauri-apps/api/process');
      await exit(0);
    } catch (err) {
      console.error('Update installation failed:', err);
      setError(err instanceof Error ? err.message : 'Update failed');
      setIsUpdating(false);
    }
  };

  const dismissUpdate = () => {
    setUpdateAvailable(false);
    setUpdateInfo(null);
  };

  if (!updateAvailable && !isUpdating) {
    return null;
  }

  return (
    <div className="auto-updater-overlay">
      <div className="auto-updater-modal">
        {isUpdating ? (
          <>
            <div className="auto-updater-header">
              <div className="auto-updater-spinner" />
              <h3>Updating Ursly VFS</h3>
            </div>
            <p className="auto-updater-message">
              Downloading update... Please don't close the app.
            </p>
            {progress && (
              <div className="auto-updater-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <div className="progress-text">
                  {progress.total > 0
                    ? `${Math.round(progress.downloaded / 1024 / 1024)} MB / ${Math.round(progress.total / 1024 / 1024)} MB`
                    : 'Downloading...'}
                </div>
                <div className="progress-percent">
                  {Math.round(progress.percent)}%
                </div>
              </div>
            )}
            {error && (
              <div className="auto-updater-error">
                <p>{error}</p>
                <button onClick={() => setIsUpdating(false)}>Close</button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="auto-updater-header">
              <h3>Update Available</h3>
            </div>
            {updateInfo && (
              <div className="auto-updater-info">
                <p>
                  <strong>Version {updateInfo.version}</strong>
                </p>
                <p>{updateInfo.body}</p>
              </div>
            )}
            <div className="auto-updater-actions">
              <button
                className="btn-primary"
                onClick={installUpdate}
                disabled={isChecking}
              >
                Install Update
              </button>
              <button
                className="btn-secondary"
                onClick={dismissUpdate}
                disabled={isChecking}
              >
                Later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
