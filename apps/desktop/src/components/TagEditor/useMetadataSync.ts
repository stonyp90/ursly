import { useEffect, useCallback, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STORAGE_KEY_PREFIX = 'vfs_metadata_';
const DIRTY_KEY = 'vfs_metadata_dirty';
const SYNC_INTERVAL = 30000; // 30 seconds

interface SyncStatus {
  lastSync: Date | null;
  syncing: boolean;
  pendingCount: number;
  error: string | null;
}

interface FileMetadata {
  tags: Array<{ name: string; color?: string }>;
  isFavorite: boolean;
  colorLabel: string | null;
  rating: number | null;
  comment: string | null;
}

/**
 * Hook for syncing file metadata between localStorage and MongoDB API
 */
export function useMetadataSync(authToken: string | null) {
  const [status, setStatus] = useState<SyncStatus>({
    lastSync: null,
    syncing: false,
    pendingCount: 0,
    error: null,
  });

  // Get pending items count
  const getPendingCount = useCallback(() => {
    try {
      const dirty = JSON.parse(localStorage.getItem(DIRTY_KEY) || '[]');
      return dirty.length;
    } catch {
      return 0;
    }
  }, []);

  // Sync dirty items to API
  const syncToApi = useCallback(async () => {
    if (!authToken) {
      setStatus((prev) => ({ ...prev, error: 'No auth token' }));
      return;
    }

    const dirty: string[] = JSON.parse(localStorage.getItem(DIRTY_KEY) || '[]');
    if (dirty.length === 0) {
      setStatus((prev) => ({ ...prev, syncing: false, pendingCount: 0 }));
      return;
    }

    setStatus((prev) => ({ ...prev, syncing: true, error: null }));

    const items: Array<{
      sourceId: string;
      path: string;
      tags?: Array<{ name: string; color?: string }>;
      isFavorite?: boolean;
      colorLabel?: string | null;
      rating?: number | null;
      comment?: string | null;
    }> = [];

    for (const key of dirty) {
      const [sourceId, ...pathParts] = key.split(':');
      const path = pathParts.join(':'); // Handle paths with colons

      try {
        const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
        if (data) {
          const metadata = JSON.parse(data) as FileMetadata;
          items.push({
            sourceId,
            path,
            tags: metadata.tags,
            isFavorite: metadata.isFavorite,
            colorLabel: metadata.colorLabel,
            rating: metadata.rating,
            comment: metadata.comment,
          });
        }
      } catch (error) {
        console.error(`Failed to parse metadata for ${key}:`, error);
      }
    }

    if (items.length === 0) {
      localStorage.setItem(DIRTY_KEY, '[]');
      setStatus((prev) => ({ ...prev, syncing: false, pendingCount: 0 }));
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/file-metadata/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Clear synced items from dirty list
      if (result.synced > 0) {
        const remaining = dirty.slice(result.synced);
        localStorage.setItem(DIRTY_KEY, JSON.stringify(remaining));
      }

      setStatus({
        lastSync: new Date(),
        syncing: false,
        pendingCount: getPendingCount(),
        error: null,
      });
    } catch (error) {
      console.error('Sync error:', error);
      setStatus((prev) => ({
        ...prev,
        syncing: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      }));
    }
  }, [authToken, getPendingCount]);

  // Fetch from API and update localStorage
  const fetchFromApi = useCallback(
    async (sourceId: string, path: string): Promise<FileMetadata | null> => {
      if (!authToken) return null;

      try {
        const response = await fetch(
          `${API_BASE_URL}/file-metadata/${sourceId}?path=${encodeURIComponent(path)}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          },
        );

        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error(`Fetch failed: ${response.statusText}`);
        }

        const data = await response.json();

        // Update localStorage with API data
        if (data) {
          const key = `${STORAGE_KEY_PREFIX}${sourceId}:${path}`;
          localStorage.setItem(
            key,
            JSON.stringify({
              tags: data.tags || [],
              isFavorite: data.isFavorite || false,
              colorLabel: data.colorLabel,
              rating: data.rating,
              comment: data.comment,
            }),
          );
        }

        return data;
      } catch (error) {
        console.error('Fetch error:', error);
        return null;
      }
    },
    [authToken],
  );

  // Initial sync and periodic sync
  useEffect(() => {
    // Initial count
    setStatus((prev) => ({ ...prev, pendingCount: getPendingCount() }));

    // Sync on mount if there are pending items
    if (getPendingCount() > 0) {
      syncToApi();
    }

    // Periodic sync
    const interval = setInterval(() => {
      if (getPendingCount() > 0) {
        syncToApi();
      }
    }, SYNC_INTERVAL);

    return () => clearInterval(interval);
  }, [syncToApi, getPendingCount]);

  // Sync before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (getPendingCount() > 0) {
        // Use navigator.sendBeacon for reliable sync on page close
        const dirty: string[] = JSON.parse(
          localStorage.getItem(DIRTY_KEY) || '[]',
        );
        const items = dirty
          .map((key) => {
            const [sourceId, ...pathParts] = key.split(':');
            const path = pathParts.join(':');
            const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
            return data ? { sourceId, path, ...JSON.parse(data) } : null;
          })
          .filter(Boolean);

        if (items.length > 0 && authToken) {
          navigator.sendBeacon(
            `${API_BASE_URL}/file-metadata/sync`,
            new Blob([JSON.stringify({ items })], { type: 'application/json' }),
          );
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [authToken, getPendingCount]);

  return {
    status,
    syncNow: syncToApi,
    fetchMetadata: fetchFromApi,
    pendingCount: status.pendingCount,
  };
}

export default useMetadataSync;
