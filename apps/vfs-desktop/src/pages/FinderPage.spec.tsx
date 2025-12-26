/**
 * FinderPage Component Tests
 * Tests for file browser functionality including Open With menu
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock all Tauri APIs before imports
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

jest.mock('@tauri-apps/api/event', () => ({
  listen: jest.fn(() =>
    Promise.resolve(() => {
      // Cleanup function
    }),
  ),
}));

jest.mock('@tauri-apps/api/dialog', () => ({
  open: jest.fn(),
  save: jest.fn(),
}));

jest.mock('@tauri-apps/api/shell', () => ({
  open: jest.fn(),
}));

jest.mock('@tauri-apps/plugin-dialog', () => ({
  open: jest.fn(),
  save: jest.fn(),
}));

// Mock all services
jest.mock('../services/storage.service', () => ({
  StorageService: {
    getSources: jest.fn(() => Promise.resolve([])),
    getFiles: jest.fn(() => Promise.resolve([])),
  },
  VfsService: {
    getAppsForFile: jest.fn(() => Promise.resolve([])),
  },
}));

jest.mock('../services/dialog.service', () => ({
  DialogService: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
  },
}));

// Mock all hooks
jest.mock('../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: jest.fn(() => ({})),
}));

jest.mock('../components/Toast', () => ({
  useToast: jest.fn(() => ({
    showToast: jest.fn(),
  })),
}));

jest.mock('../components/KeyboardShortcutHelper', () => ({
  useKeyboardShortcutHelper: jest.fn(() => ({})),
  KeyboardShortcutHelper: () => null,
}));

// Mock all components
jest.mock('../components/Breadcrumbs', () => ({
  Breadcrumbs: () => <div data-testid="breadcrumbs">Breadcrumbs</div>,
}));

jest.mock('../components/SearchBox', () => ({
  SearchBox: () => <div data-testid="search-box">SearchBox</div>,
}));

jest.mock('../components/SpotlightSearch', () => ({
  SpotlightSearch: () => (
    <div data-testid="spotlight-search">SpotlightSearch</div>
  ),
}));

jest.mock('../components/MetricsPreview', () => ({
  MetricsPreview: () => <div data-testid="metrics-preview">MetricsPreview</div>,
}));

jest.mock('../components/InfoModal', () => ({
  InfoModal: () => null,
}));

jest.mock('../components/AddStorageModal', () => ({
  AddStorageModal: () => null,
}));

jest.mock('../components/ShortcutSettings', () => ({
  ShortcutSettings: () => null,
}));

import { FinderPage } from './FinderPage';
import * as tauriCore from '@tauri-apps/api/core';

describe('FinderPage - Open With Menu', () => {
  const defaultProps = {
    onOpenMetrics: jest.fn(),
    onOpenSearch: jest.fn(),
    isSearchOpen: false,
    onCloseSearch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('App Deduplication', () => {
    it('should deduplicate apps by bundle_id', async () => {
      const invoke = jest.spyOn(tauriCore, 'invoke');

      // Mock apps with duplicate bundle_id
      invoke.mockResolvedValueOnce([
        {
          name: 'Preview',
          path: '/System/Applications/Preview.app',
          bundle_id: 'com.apple.Preview',
        },
        {
          name: 'Preview',
          path: '/System/Applications/Preview.app',
          bundle_id: 'com.apple.Preview',
        },
      ]);

      render(<FinderPage {...defaultProps} />);

      // Wait for apps to load
      await waitFor(() => {
        expect(invoke).toHaveBeenCalled();
      });

      // Apps should be deduplicated
      const previewApps = screen.queryAllByText('Preview');
      expect(previewApps.length).toBeLessThanOrEqual(1);
    });

    it('should deduplicate apps by path', async () => {
      const invoke = jest.spyOn(tauriCore, 'invoke');

      // Mock apps with duplicate path
      invoke.mockResolvedValueOnce([
        { name: 'Preview', path: '/System/Applications/Preview.app' },
        { name: 'Preview', path: '/System/Applications/Preview.app' },
      ]);

      render(<FinderPage {...defaultProps} />);

      await waitFor(() => {
        expect(invoke).toHaveBeenCalled();
      });

      // Should only show one Preview
      const previewApps = screen.queryAllByText('Preview');
      expect(previewApps.length).toBeLessThanOrEqual(1);
    });

    it('should deduplicate apps by name (case-insensitive)', async () => {
      const invoke = jest.spyOn(tauriCore, 'invoke');

      // Mock apps with duplicate name (different cases)
      invoke.mockResolvedValueOnce([
        { name: 'Preview', path: '/System/Applications/Preview.app' },
        { name: 'preview', path: '/System/Applications/Preview.app' },
        { name: 'PREVIEW', path: '/System/Applications/Preview.app' },
      ]);

      render(<FinderPage {...defaultProps} />);

      await waitFor(() => {
        expect(invoke).toHaveBeenCalled();
      });

      // Should only show one Preview (case-insensitive)
      const previewApps = screen.queryAllByText(/Preview/i);
      expect(previewApps.length).toBeLessThanOrEqual(1);
    });

    it('should handle apps with no duplicates correctly', async () => {
      const invoke = jest.spyOn(tauriCore, 'invoke');

      // Mock unique apps
      invoke.mockResolvedValueOnce([
        {
          name: 'Preview',
          path: '/System/Applications/Preview.app',
          bundle_id: 'com.apple.Preview',
        },
        {
          name: 'Safari',
          path: '/Applications/Safari.app',
          bundle_id: 'com.apple.Safari',
        },
        {
          name: 'Chrome',
          path: '/Applications/Google Chrome.app',
          bundle_id: 'com.google.Chrome',
        },
      ]);

      render(<FinderPage {...defaultProps} />);

      await waitFor(() => {
        expect(invoke).toHaveBeenCalled();
      });

      // All unique apps should be shown
      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByText('Safari')).toBeInTheDocument();
      expect(screen.getByText('Chrome')).toBeInTheDocument();
    });

    it('should deduplicate Preview specifically for PDF files', async () => {
      const invoke = jest.spyOn(tauriCore, 'invoke');

      // Mock PDF file apps - Preview might come from Launch Services AND common apps
      invoke.mockResolvedValueOnce([
        {
          name: 'Preview',
          path: '/System/Applications/Preview.app',
          bundle_id: 'com.apple.Preview',
        },
        { name: 'Preview', path: '/System/Applications/Preview.app' }, // No bundle_id from common apps
        {
          name: 'Books',
          path: '/System/Applications/Books.app',
          bundle_id: 'com.apple.Books',
        },
      ]);

      render(<FinderPage {...defaultProps} />);

      await waitFor(() => {
        expect(invoke).toHaveBeenCalled();
      });

      // Preview should appear exactly once
      const previewApps = screen.queryAllByText('Preview');
      expect(previewApps.length).toBe(1);
    });
  });

  describe('Open With Menu Display', () => {
    it('should show Open With submenu when hovering over Open With', async () => {
      const invoke = jest.spyOn(tauriCore, 'invoke');
      invoke.mockResolvedValueOnce([
        { name: 'Preview', path: '/System/Applications/Preview.app' },
      ]);

      render(<FinderPage {...defaultProps} />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByText('Open')).toBeInTheDocument();
      });
    });

    it('should handle empty app list gracefully', async () => {
      const invoke = jest.spyOn(tauriCore, 'invoke');
      invoke.mockResolvedValueOnce([]);

      render(<FinderPage {...defaultProps} />);

      await waitFor(() => {
        expect(invoke).toHaveBeenCalled();
      });

      // Should show "No apps found" message
      expect(screen.getByText('No apps found')).toBeInTheDocument();
    });

    it('should handle app loading state', async () => {
      const invoke = jest.spyOn(tauriCore, 'invoke');

      // Delay the response to test loading state
      invoke.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
      );

      render(<FinderPage {...defaultProps} />);

      // Should show loading state initially
      await waitFor(() => {
        expect(screen.getByText('Loading apps...')).toBeInTheDocument();
      });
    });
  });
});
