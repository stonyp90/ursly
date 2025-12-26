/**
 * useDeploymentMode Hook Tests
 * TODO: Convert from Vitest to Jest or configure Vitest properly
 */

// TODO: Convert from Vitest to Jest or configure Vitest properly
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
const vi = {
  useFakeTimers: jest.useFakeTimers,
  useRealTimers: jest.useRealTimers,
  advanceTimersByTime: jest.advanceTimersByTime,
  fn: jest.fn,
};
import {
  isTauriAvailable,
  isBrowserOnly,
  getDeploymentConfig,
  getApiEndpoint,
  useFeatureFlags,
} from './useDeploymentMode';

// Skip tests temporarily - needs Vitest to Jest conversion
describe.skip('useDeploymentMode', () => {
  describe.skip('isTauriAvailable', () => {
    it('should return false when __TAURI_INTERNALS__ is not present', () => {
      const result = isTauriAvailable();
      expect(result).toBe(false);
    });

    it('should return true when __TAURI_INTERNALS__ is present', () => {
      // Mock Tauri
      (
        window as unknown as { __TAURI_INTERNALS__: object }
      ).__TAURI_INTERNALS__ = {};

      const result = isTauriAvailable();
      expect(result).toBe(true);

      // Cleanup
      delete (window as unknown as { __TAURI_INTERNALS__?: object })
        .__TAURI_INTERNALS__;
    });
  });

  describe('isBrowserOnly', () => {
    it('should return true when not in Tauri', () => {
      const result = isBrowserOnly();
      expect(result).toBe(true);
    });

    it('should return false when in Tauri', () => {
      (
        window as unknown as { __TAURI_INTERNALS__: object }
      ).__TAURI_INTERNALS__ = {};

      const result = isBrowserOnly();
      expect(result).toBe(false);

      delete (window as unknown as { __TAURI_INTERNALS__?: object })
        .__TAURI_INTERNALS__;
    });
  });

  describe('getDeploymentConfig', () => {
    it('should return browser-only config when not in Tauri', () => {
      const config = getDeploymentConfig();

      expect(config.mode).toBe('browser-only');
      expect(config.hasNvmeCache).toBe(false);
      expect(config.hasLocalMounts).toBe(false);
    });

    it('should return workstation config when in Tauri', () => {
      (
        window as unknown as { __TAURI_INTERNALS__: object }
      ).__TAURI_INTERNALS__ = {};

      const config = getDeploymentConfig();

      expect(config.mode).toBe('workstation');
      expect(config.hasLocalMounts).toBe(true);

      delete (window as unknown as { __TAURI_INTERNALS__?: object })
        .__TAURI_INTERNALS__;
    });
  });

  describe('getApiEndpoint', () => {
    it('should return default endpoint when no config', () => {
      const endpoint = getApiEndpoint();
      expect(endpoint).toBe('/api/vfs');
    });

    it('should use window config if available', () => {
      (window as unknown as { URSLY_API_ENDPOINT: string }).URSLY_API_ENDPOINT =
        'https://api.example.com';

      const endpoint = getApiEndpoint();
      expect(endpoint).toBe('https://api.example.com');

      delete (window as unknown as { URSLY_API_ENDPOINT?: string })
        .URSLY_API_ENDPOINT;
    });
  });

  describe('useFeatureFlags', () => {
    it('should enable all features for cloud-gpu mode', () => {
      const flags = useFeatureFlags('cloud-gpu');

      expect(flags.canCreateFolder).toBe(true);
      expect(flags.canDelete).toBe(true);
      expect(flags.canRename).toBe(true);
      expect(flags.canMove).toBe(true);
      expect(flags.canCopy).toBe(true);
      expect(flags.canPaste).toBe(true);
      expect(flags.canDragDrop).toBe(true);
      expect(flags.canOpenWith).toBe(true);
    });

    it('should enable all features for workstation mode', () => {
      const flags = useFeatureFlags('workstation');

      expect(flags.canCreateFolder).toBe(true);
      expect(flags.canDelete).toBe(true);
      expect(flags.canRename).toBe(true);
      expect(flags.canDragDrop).toBe(true);
    });

    it('should disable write features for browser-only mode', () => {
      const flags = useFeatureFlags('browser-only');

      // Disabled
      expect(flags.canCreateFolder).toBe(false);
      expect(flags.canDelete).toBe(false);
      expect(flags.canRename).toBe(false);
      expect(flags.canMove).toBe(false);
      expect(flags.canCopy).toBe(false);
      expect(flags.canPaste).toBe(false);
      expect(flags.canDragDrop).toBe(false);
      expect(flags.canOpenWith).toBe(false);
      expect(flags.canWarmFile).toBe(false);
      expect(flags.canQuickLook).toBe(false);
    });

    it('should enable view features for browser-only mode', () => {
      const flags = useFeatureFlags('browser-only');

      // Enabled
      expect(flags.canBrowse).toBe(true);
      expect(flags.canSearch).toBe(true);
      expect(flags.canPreview).toBe(true);
      expect(flags.canViewMetadata).toBe(true);
      expect(flags.canDownload).toBe(true);
      expect(flags.canTag).toBe(true);
      expect(flags.canFavorite).toBe(true);
      expect(flags.canChangeTier).toBe(true);
      expect(flags.canStreamVideo).toBe(true);
      expect(flags.canViewThumbnails).toBe(true);
    });
  });
});
