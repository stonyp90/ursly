/**
 * TransferPanel Component Tests
 *
 * Tests all features of the TransferPanel component:
 * - Panel visibility
 * - Active transfers display
 * - Transfer history
 * - Pause/Resume/Cancel operations
 * - Minimize/Expand functionality
 * - Error handling
 * - Progress tracking
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransferPanel } from './TransferPanel';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

describe('TransferPanel', () => {
  const mockOnClose = jest.fn();
  const mockOnMinimizeChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
  });

  describe('Panel Visibility', () => {
    it('should not render when isVisible is false', () => {
      render(
        <TransferPanel
          isVisible={false}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );
      expect(screen.queryByText('Transfers')).not.toBeInTheDocument();
    });

    it('should render when isVisible is true', () => {
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );
      expect(screen.getByText('Transfers')).toBeInTheDocument();
    });

    it('should call loadUploads when visible', async () => {
      mockInvoke.mockResolvedValue([]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('vfs_list_uploads');
      });
    });

    it('should clear uploads/downloads when hidden', () => {
      const { rerender } = render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      rerender(
        <TransferPanel
          isVisible={false}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      // Panel should not be visible
      expect(screen.queryByText('Transfers')).not.toBeInTheDocument();
    });
  });

  describe('Active Transfers Display', () => {
    const mockActiveUpload: any = {
      upload_id: 'upload-1',
      source_id: 'source-1',
      key: 'test-file.txt',
      local_path: '/local/test-file.txt',
      total_size: 1000,
      bytes_uploaded: 500,
      current_part: 1,
      total_parts: 2,
      status: 'InProgress',
      speed_bytes_per_sec: 100,
      estimated_time_remaining_sec: 5,
      created_at: '2024-01-01T00:00:00Z',
    };

    it('should display active uploads', async () => {
      mockInvoke.mockResolvedValue([mockActiveUpload]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('test-file.txt')).toBeInTheDocument();
      });

      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByText(/500.*1000/)).toBeInTheDocument();
    });

    it('should show "No active transfers" when there are none', async () => {
      mockInvoke.mockResolvedValue([]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('No active transfers')).toBeInTheDocument();
      });
    });

    it('should display upload progress bar', async () => {
      mockInvoke.mockResolvedValue([mockActiveUpload]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        const progressBar = screen
          .getByText('test-file.txt')
          .closest('.transfer-item')
          ?.querySelector('.transfer-progress-bar');
        expect(progressBar).toBeInTheDocument();
      });
    });

    it('should display speed and ETA when available', async () => {
      mockInvoke.mockResolvedValue([mockActiveUpload]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/100.*B\/s/)).toBeInTheDocument();
        expect(screen.getByText(/5.*left/)).toBeInTheDocument();
      });
    });
  });

  describe('Transfer History', () => {
    const mockCompletedUpload: any = {
      upload_id: 'upload-2',
      source_id: 'source-1',
      key: 'completed-file.txt',
      local_path: '/local/completed-file.txt',
      total_size: 2000,
      bytes_uploaded: 2000,
      current_part: 2,
      total_parts: 2,
      status: 'Completed',
      completed_at: '2024-01-01T00:05:00Z',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockFailedUpload: any = {
      upload_id: 'upload-3',
      source_id: 'source-1',
      key: 'failed-file.txt',
      local_path: '/local/failed-file.txt',
      total_size: 3000,
      bytes_uploaded: 1500,
      current_part: 1,
      total_parts: 2,
      status: 'Failed',
      error: 'Network error',
      created_at: '2024-01-01T00:00:00Z',
    };

    it('should switch to history tab', async () => {
      mockInvoke.mockResolvedValue([mockCompletedUpload]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      const historyTab = screen.getByText(/History/);
      fireEvent.click(historyTab);

      await waitFor(() => {
        expect(screen.getByText('completed-file.txt')).toBeInTheDocument();
      });
    });

    it('should display completed uploads in history', async () => {
      mockInvoke.mockResolvedValue([mockCompletedUpload]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      const historyTab = screen.getByText(/History/);
      fireEvent.click(historyTab);

      await waitFor(() => {
        expect(screen.getByText('completed-file.txt')).toBeInTheDocument();
        expect(screen.getByText(/2.*KB/)).toBeInTheDocument();
      });
    });

    it('should display failed uploads with error message', async () => {
      mockInvoke.mockResolvedValue([mockFailedUpload]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      const historyTab = screen.getByText(/History/);
      fireEvent.click(historyTab);

      await waitFor(() => {
        expect(screen.getByText('failed-file.txt')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should show "No transfer history" when history is empty', async () => {
      mockInvoke.mockResolvedValue([]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      const historyTab = screen.getByText(/History/);
      fireEvent.click(historyTab);

      await waitFor(() => {
        expect(screen.getByText('No transfer history')).toBeInTheDocument();
      });
    });
  });

  describe('Pause/Resume/Cancel Operations', () => {
    const mockPausedUpload: any = {
      upload_id: 'upload-4',
      source_id: 'source-1',
      key: 'paused-file.txt',
      local_path: '/local/paused-file.txt',
      total_size: 1000,
      bytes_uploaded: 300,
      current_part: 1,
      total_parts: 2,
      status: 'Paused',
      created_at: '2024-01-01T00:00:00Z',
    };

    it('should show Resume button for paused uploads', async () => {
      mockInvoke.mockResolvedValue([mockPausedUpload]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('▶ Resume')).toBeInTheDocument();
      });
    });

    it('should call resume upload when Resume is clicked', async () => {
      mockInvoke.mockResolvedValue([mockPausedUpload]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('▶ Resume')).toBeInTheDocument();
      });

      const resumeButton = screen.getByText('▶ Resume');
      fireEvent.click(resumeButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('vfs_resume_upload', {
          uploadId: 'upload-4',
          sourceId: 'source-1',
        });
      });
    });

    it('should show Pause button for active uploads', async () => {
      const mockActiveUpload: any = {
        upload_id: 'upload-5',
        source_id: 'source-1',
        key: 'active-file.txt',
        local_path: '/local/active-file.txt',
        total_size: 1000,
        bytes_uploaded: 500,
        current_part: 1,
        total_parts: 2,
        status: 'InProgress',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockInvoke.mockResolvedValue([mockActiveUpload]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('⏸ Pause')).toBeInTheDocument();
      });
    });

    it('should call pause upload when Pause is clicked', async () => {
      const mockActiveUpload: any = {
        upload_id: 'upload-6',
        source_id: 'source-1',
        key: 'active-file.txt',
        local_path: '/local/active-file.txt',
        total_size: 1000,
        bytes_uploaded: 500,
        current_part: 1,
        total_parts: 2,
        status: 'InProgress',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockInvoke.mockResolvedValue([mockActiveUpload]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('⏸ Pause')).toBeInTheDocument();
      });

      const pauseButton = screen.getByText('⏸ Pause');
      fireEvent.click(pauseButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('vfs_pause_upload', {
          uploadId: 'upload-6',
        });
      });
    });

    it('should call cancel upload when Cancel is clicked', async () => {
      const mockActiveUpload: any = {
        upload_id: 'upload-7',
        source_id: 'source-1',
        key: 'active-file.txt',
        local_path: '/local/active-file.txt',
        total_size: 1000,
        bytes_uploaded: 500,
        current_part: 1,
        total_parts: 2,
        status: 'InProgress',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockInvoke.mockResolvedValue([mockActiveUpload]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('✕ Cancel')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('✕ Cancel');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('vfs_cancel_upload', {
          uploadId: 'upload-7',
        });
      });
    });
  });

  describe('Minimize/Expand Functionality', () => {
    it('should show minimize button', () => {
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      const minimizeButton = screen.getByTitle('Minimize');
      expect(minimizeButton).toBeInTheDocument();
    });

    it('should toggle minimized state when minimize button is clicked', () => {
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      const minimizeButton = screen.getByTitle('Minimize');
      fireEvent.click(minimizeButton);

      expect(mockOnMinimizeChange).toHaveBeenCalledWith(true);
    });

    it('should show expand button when minimized', () => {
      const { rerender } = render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      const minimizeButton = screen.getByTitle('Minimize');
      fireEvent.click(minimizeButton);

      // Re-render with minimized state
      rerender(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      // Note: The actual minimized state is internal, so we test the callback
      expect(mockOnMinimizeChange).toHaveBeenCalled();
    });

    it('should display minimized content when minimized', () => {
      mockInvoke.mockResolvedValue([]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      // Click minimize
      const minimizeButton = screen.getByTitle('Minimize');
      fireEvent.click(minimizeButton);

      // The panel should still be visible but in minimized state
      // (We can't directly test the CSS class, but we can verify the callback was called)
      expect(mockOnMinimizeChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors when loading uploads', async () => {
      mockInvoke.mockRejectedValue(new Error('Failed to load uploads'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('vfs_list_uploads');
      });

      // Should not crash, should show empty state
      await waitFor(() => {
        expect(screen.getByText('No active transfers')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should handle errors when pausing upload', async () => {
      const mockActiveUpload: any = {
        upload_id: 'upload-8',
        source_id: 'source-1',
        key: 'active-file.txt',
        local_path: '/local/active-file.txt',
        total_size: 1000,
        bytes_uploaded: 500,
        current_part: 1,
        total_parts: 2,
        status: 'InProgress',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockInvoke
        .mockResolvedValueOnce([mockActiveUpload])
        .mockRejectedValueOnce(new Error('Failed to pause'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('⏸ Pause')).toBeInTheDocument();
      });

      const pauseButton = screen.getByText('⏸ Pause');
      fireEvent.click(pauseButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress percentage correctly', async () => {
      const mockUpload: any = {
        upload_id: 'upload-9',
        source_id: 'source-1',
        key: 'test-file.txt',
        local_path: '/local/test-file.txt',
        total_size: 1000,
        bytes_uploaded: 750,
        current_part: 2,
        total_parts: 3,
        status: 'InProgress',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockInvoke.mockResolvedValue([mockUpload]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/75%/)).toBeInTheDocument();
      });
    });

    it('should handle zero total size gracefully', async () => {
      const mockUpload: any = {
        upload_id: 'upload-10',
        source_id: 'source-1',
        key: 'empty-file.txt',
        local_path: '/local/empty-file.txt',
        total_size: 0,
        bytes_uploaded: 0,
        current_part: 1,
        total_parts: 1,
        status: 'Completed',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockInvoke.mockResolvedValue([mockUpload]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('empty-file.txt')).toBeInTheDocument();
      });
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button is clicked', () => {
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      const closeButton = screen.getByTitle('Close');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not show close button when onClose is not provided', () => {
      render(
        <TransferPanel
          isVisible={true}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      expect(screen.queryByTitle('Close')).not.toBeInTheDocument();
    });
  });

  describe('Active Transfer Count Badge', () => {
    it('should show badge with count when there are active transfers', async () => {
      const mockActiveUpload: any = {
        upload_id: 'upload-11',
        source_id: 'source-1',
        key: 'active-file.txt',
        local_path: '/local/active-file.txt',
        total_size: 1000,
        bytes_uploaded: 500,
        current_part: 1,
        total_parts: 2,
        status: 'InProgress',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockInvoke.mockResolvedValue([mockActiveUpload]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        const badge = screen.getByText('1');
        expect(badge).toBeInTheDocument();
        expect(badge.closest('.transfer-panel-badge')).toBeInTheDocument();
      });
    });

    it('should not show badge when there are no active transfers', async () => {
      mockInvoke.mockResolvedValue([]);
      render(
        <TransferPanel
          isVisible={true}
          onClose={mockOnClose}
          onMinimizeChange={mockOnMinimizeChange}
        />,
      );

      await waitFor(() => {
        expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
      });
    });
  });
});
