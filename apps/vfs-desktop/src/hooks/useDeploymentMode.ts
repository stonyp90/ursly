/**
 * useDeploymentMode - Hook to detect and manage deployment mode
 *
 * Detects whether the app is running in:
 * - cloud-gpu: Windows Server with GPU, FSx ONTAP mounted
 * - workstation: Local machine with LucidLink
 * - browser-only: Web browser without native access
 */

import { useState, useEffect } from 'react';
import type { DeploymentMode, DeploymentConfig } from '../types/storage';

/**
 * Check if Tauri is available
 */
export function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Check if running in a browser (not Tauri/Electron)
 */
export function isBrowserOnly(): boolean {
  return !isTauriAvailable();
}

/**
 * Get the base deployment configuration
 */
export function getDeploymentConfig(): DeploymentConfig {
  // Browser-only mode
  if (isBrowserOnly()) {
    return {
      mode: 'browser-only',
      hasNvmeCache: false,
      hasLocalMounts: false,
      apiEndpoint: getApiEndpoint(),
    };
  }

  // Running in Tauri - check for specific mode
  // This will be determined by the Tauri backend
  return {
    mode: 'workstation', // Default for Tauri
    hasNvmeCache: false,
    hasLocalMounts: true,
  };
}

/**
 * Get API endpoint from environment or config
 */
import { getEnvVar } from '../utils/env';

export function getApiEndpoint(): string {
  // Check for environment variable
  const endpoint = getEnvVar('VITE_API_ENDPOINT');
  if (endpoint) {
    return endpoint;
  }

  // Check window config
  if (
    typeof window !== 'undefined' &&
    (window as unknown as { URSLY_API_ENDPOINT?: string }).URSLY_API_ENDPOINT
  ) {
    return (window as unknown as { URSLY_API_ENDPOINT: string })
      .URSLY_API_ENDPOINT;
  }

  // Default to relative path for same-origin API
  return '/api/vfs';
}

/**
 * Hook to get current deployment mode
 */
export function useDeploymentMode() {
  const [config, setConfig] = useState<DeploymentConfig>(getDeploymentConfig);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const detectMode = async () => {
      setIsLoading(true);

      try {
        if (isTauriAvailable()) {
          // Query Tauri for actual deployment config
          const { invoke } = await import('@tauri-apps/api/core');

          try {
            // Try to get deployment config from Tauri
            const tauriConfig = await invoke<DeploymentConfig>(
              'get_deployment_config',
            );
            setConfig(tauriConfig);
          } catch {
            // Fallback to workstation mode if command doesn't exist
            setConfig({
              mode: 'workstation',
              hasNvmeCache: false,
              hasLocalMounts: true,
            });
          }
        } else {
          // Browser-only mode
          setConfig({
            mode: 'browser-only',
            hasNvmeCache: false,
            hasLocalMounts: false,
            apiEndpoint: getApiEndpoint(),
          });
        }
      } catch (error) {
        console.error('Failed to detect deployment mode:', error);
        setConfig(getDeploymentConfig());
      } finally {
        setIsLoading(false);
      }
    };

    detectMode();
  }, []);

  return {
    config,
    mode: config.mode,
    isBrowserOnly: config.mode === 'browser-only',
    isWorkstation: config.mode === 'workstation',
    isCloudGpu: config.mode === 'cloud-gpu',
    hasNvmeCache: config.hasNvmeCache,
    hasLocalMounts: config.hasLocalMounts,
    isLoading,
  };
}

/**
 * Mode-aware feature flags
 */
export function useFeatureFlags(mode: DeploymentMode) {
  return {
    // File operations
    canCreateFolder: mode !== 'browser-only',
    canDelete: mode !== 'browser-only',
    canRename: mode !== 'browser-only',
    canMove: mode !== 'browser-only',
    canCopy: mode !== 'browser-only',
    canPaste: mode !== 'browser-only',

    // View operations (all modes)
    canBrowse: true,
    canSearch: true,
    canPreview: true,
    canViewMetadata: true,

    // Download (all modes, but different implementation)
    canDownload: true,

    // Tagging (all modes via API)
    canTag: true,
    canFavorite: true,

    // Tier operations
    canChangeTier: true, // Creates request in browser mode
    canWarmFile: mode !== 'browser-only',

    // Advanced features
    canDragDrop: mode !== 'browser-only',
    canOpenWith: mode !== 'browser-only',
    canQuickLook: mode !== 'browser-only',

    // Streaming/preview
    canStreamVideo: true,
    canViewThumbnails: true,
  };
}

export default useDeploymentMode;
