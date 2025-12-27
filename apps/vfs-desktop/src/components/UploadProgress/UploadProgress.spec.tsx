/**
 * UploadProgress Component Tests
 *
 * Tests all features of the UploadProgress component:
 * - Progress display
 * - Status updates
 * - Pause/Resume functionality
 * - Cancel functionality
 * - Error handling
 * - Completion callbacks
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UploadProgress } from './UploadProgress';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

describe('UploadProgress', () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();
  const uploadId = 'test-upload-1';

  const mockProgressData = {
    upload_id: uploadId,
    key: 'test-file.txt',
    bytes_uploaded: 500,
    total_size: 1000,
    percentage: 50,
    current_part: 1,
    total_parts: 2,
    status: 'InProgress' as const,
    speed_bytes_per_sec: 100,
    estimated_time_remaining_sec: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Progress Display', () => {
    it('should show loading state initially', () => {
      mockInvoke.mockResolvedValue(null);
      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should display progress when data is available', async () => {
      mockInvoke.mockResolvedValue(mockProgressData);
      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('test-file.txt')).toBeInTheDocument();
      });

      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });

    it('should display file size information', async () => {
      mockInvoke.mockResolvedValue(mockProgressData);
      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/500.*B/)).toBeInTheDocument();
        expect(screen.getByText(/1000.*B/)).toBeInTheDocument();
      });
    });

    it('should display speed when available', async () => {
      mockInvoke.mockResolvedValue(mockProgressData);
      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/100.*B\/s/)).toBeInTheDocument();
      });
    });

    it('should display ETA when available', async () => {
      mockInvoke.mockResolvedValue(mockProgressData);
      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/5s.*remaining/)).toBeInTheDocument();
      });
    });
  });

  describe('Status Updates', () => {
    it('should poll for progress updates', async () => {
      mockInvoke.mockResolvedValue(mockProgressData);
      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('vfs_get_upload_progress', {
          uploadId,
        });
      });

      // Advance timer to trigger next poll
      jest.advanceTimersByTime(500);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledTimes(2);
      });
    });

    it('should call onComplete when upload completes', async () => {
      const completedData = {
        ...mockProgressData,
        status: 'Completed' as const,
        bytes_uploaded: 1000,
        percentage: 100,
      };

      mockInvoke.mockResolvedValue(completedData);
      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });

    it('should display error message when upload fails', async () => {
      const failedData = {
        ...mockProgressData,
        status: 'Failed' as const,
        error: 'Network error',
      };

      mockInvoke.mockResolvedValue(failedData);
      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Pause/Resume Functionality', () => {
    it('should show Pause button for active uploads', async () => {
      mockInvoke.mockResolvedValue(mockProgressData);
      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Pause/i)).toBeInTheDocument();
      });
    });

    it('should show Resume button for paused uploads', async () => {
      const pausedData = {
        ...mockProgressData,
        status: 'Paused' as const,
      };

      mockInvoke.mockResolvedValue(pausedData);
      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Resume/i)).toBeInTheDocument();
      });
    });

    it('should call pause upload when Pause is clicked', async () => {
      mockInvoke.mockResolvedValue(mockProgressData);
      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Pause/i)).toBeInTheDocument();
      });

      const pauseButton = screen.getByText(/Pause/i);
      fireEvent.click(pauseButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('vfs_pause_upload', {
          uploadId,
        });
      });
    });

    it('should call resume upload when Resume is clicked', async () => {
      const pausedData = {
        ...mockProgressData,
        status: 'Paused' as const,
      };

      mockInvoke
        .mockResolvedValueOnce(pausedData)
        .mockResolvedValueOnce(undefined);

      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Resume/i)).toBeInTheDocument();
      });

      const resumeButton = screen.getByText(/Resume/i);
      fireEvent.click(resumeButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('vfs_resume_upload', {
          uploadId,
        });
      });
    });

    it('should handle pause errors gracefully', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockProgressData)
        .mockRejectedValueOnce(new Error('Failed to pause'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Pause/i)).toBeInTheDocument();
      });

      const pauseButton = screen.getByText(/Pause/i);
      fireEvent.click(pauseButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Cancel Functionality', () => {
    it('should show Cancel button', async () => {
      mockInvoke.mockResolvedValue(mockProgressData);
      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Cancel/i)).toBeInTheDocument();
      });
    });

    it('should call cancel upload when Cancel is clicked', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockProgressData)
        .mockResolvedValueOnce(undefined);

      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Cancel/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByText(/Cancel/i);
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('vfs_cancel_upload', {
          uploadId,
        });
      });
    });

    it('should call onCancel callback when cancel succeeds', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockProgressData)
        .mockResolvedValueOnce(undefined);

      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Cancel/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByText(/Cancel/i);
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalled();
      });
    });

    it('should handle cancel errors gracefully', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockProgressData)
        .mockRejectedValueOnce(new Error('Failed to cancel'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Cancel/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByText(/Cancel/i);
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate percentage correctly', async () => {
      const data = {
        ...mockProgressData,
        bytes_uploaded: 750,
        total_size: 1000,
        percentage: 75,
      };

      mockInvoke.mockResolvedValue(data);
      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/75%/)).toBeInTheDocument();
      });
    });

    it('should handle zero total size', async () => {
      const data = {
        ...mockProgressData,
        bytes_uploaded: 0,
        total_size: 0,
        percentage: 0,
      };

      mockInvoke.mockResolvedValue(data);
      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('test-file.txt')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle errors when fetching progress', async () => {
      mockInvoke.mockRejectedValue(new Error('Failed to get progress'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      // Should still show loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should clear interval on unmount', async () => {
      mockInvoke.mockResolvedValue(mockProgressData);
      const { unmount } = render(
        <UploadProgress
          uploadId={uploadId}
          fileName="test-file.txt"
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
        />,
      );

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      const callCount = mockInvoke.mock.calls.length;
      unmount();

      // Advance timer - should not trigger more calls
      jest.advanceTimersByTime(1000);

      // Allow time for any pending async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockInvoke.mock.calls.length).toBe(callCount);
    }, 10000);
  });
});
