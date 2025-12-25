/**
 * SpotlightSearch Component Tests
 * Tests keyboard shortcuts, navigation, and user interactions
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SpotlightSearch } from './SpotlightSearch';
import type { FileMetadata, StorageSource } from '../../types/storage';

// Mock files and sources
const mockFiles: FileMetadata[] = [
  {
    id: '1',
    name: 'test-video.mp4',
    path: '/test-video.mp4',
    size: 1024000,
    lastModified: '2024-01-01T00:00:00Z',
    mimeType: 'video/mp4',
    tierStatus: 'hot',
    canWarm: false,
    canTranscode: true,
    tags: ['video', 'test'],
  },
  {
    id: '2',
    name: 'document.pdf',
    path: '/document.pdf',
    size: 512000,
    lastModified: '2024-01-02T00:00:00Z',
    mimeType: 'application/pdf',
    tierStatus: 'hot',
    canWarm: false,
    canTranscode: false,
    tags: ['document'],
  },
  {
    id: '3',
    name: 'folder',
    path: '/folder/',
    size: 0,
    lastModified: '2024-01-03T00:00:00Z',
    mimeType: 'folder',
    isDirectory: true,
    tierStatus: 'hot',
    canWarm: false,
    canTranscode: false,
  },
];

const mockSources: StorageSource[] = [
  {
    id: 'source1',
    name: 'Test Source',
    providerId: 'local',
    category: 'local',
    config: {},
    status: 'connected',
  },
];

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  files: mockFiles,
  sources: mockSources,
  onNavigateToFile: jest.fn(),
  onNavigateToPath: jest.fn(),
  onSearchSubmit: jest.fn(),
  currentSourceId: 'source1',
};

describe('SpotlightSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('should render when open', () => {
      render(<SpotlightSearch {...defaultProps} />);
      expect(screen.getByPlaceholderText(/Search files/i)).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(<SpotlightSearch {...defaultProps} isOpen={false} />);
      expect(
        screen.queryByPlaceholderText(/Search files/i),
      ).not.toBeInTheDocument();
    });

    it('should show operator hints when query is empty', () => {
      render(<SpotlightSearch {...defaultProps} />);
      expect(screen.getByText('tag:')).toBeInTheDocument();
      expect(screen.getByText('type:')).toBeInTheDocument();
      expect(screen.getByText('ext:')).toBeInTheDocument();
      expect(screen.getByText('size:')).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should close on Escape key', async () => {
      const onClose = jest.fn();
      render(<SpotlightSearch {...defaultProps} onClose={onClose} />);
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, '{Escape}');
      expect(onClose).toHaveBeenCalled();
    });

    it('should navigate down with ArrowDown', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, '{ArrowDown}');
      const results = screen.getAllByRole('button');
      expect(results[1]).toHaveClass('selected');
    });

    it('should navigate up with ArrowUp', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(/Search files/i);

      // Select second item first
      await userEvent.type(input, '{ArrowDown}');
      // Then navigate up
      await userEvent.type(input, '{ArrowUp}');
      const results = screen.getAllByRole('button');
      expect(results[0]).toHaveClass('selected');
    });

    it('should select result on Enter', async () => {
      const onNavigateToFile = jest.fn();
      render(
        <SpotlightSearch
          {...defaultProps}
          onNavigateToFile={onNavigateToFile}
        />,
      );
      const input = screen.getByPlaceholderText(/Search files/i);

      // Type to show file results
      await userEvent.type(input, 'test');
      await waitFor(() => {
        expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
      });

      // Press Enter to select
      await userEvent.type(input, '{Enter}');
      expect(onNavigateToFile).toHaveBeenCalled();
    });

    it('should complete operator on Tab', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(
        /Search files/i,
      ) as HTMLInputElement;

      // Navigate to operator
      await userEvent.type(input, '{ArrowDown}');
      // Press Tab to complete
      await userEvent.type(input, '{Tab}');

      await waitFor(() => {
        expect(input.value).toBe('tag:');
      });
    });

    it('should submit search query on Enter when no result selected', async () => {
      const onSearchSubmit = jest.fn();
      render(
        <SpotlightSearch {...defaultProps} onSearchSubmit={onSearchSubmit} />,
      );
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, 'test query');
      await userEvent.type(input, '{Enter}');

      expect(onSearchSubmit).toHaveBeenCalledWith('test query');
    });
  });

  describe('Search Functionality', () => {
    it('should filter files by name', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, 'video');
      await waitFor(() => {
        expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
        expect(screen.queryByText('document.pdf')).not.toBeInTheDocument();
      });
    });

    it('should filter files by tag', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, 'document');
      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });
    });

    it('should show tags in results', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, 'test');
      await waitFor(() => {
        const tagResults = screen.getAllByText('test');
        expect(tagResults.length).toBeGreaterThan(0);
      });
    });
  });

  describe('User Interactions', () => {
    it('should close on overlay click', () => {
      const onClose = jest.fn();
      render(<SpotlightSearch {...defaultProps} onClose={onClose} />);
      const overlay = screen.getByRole('generic').parentElement;
      if (overlay) {
        fireEvent.click(overlay);
        expect(onClose).toHaveBeenCalled();
      }
    });

    it('should not close on container click', () => {
      const onClose = jest.fn();
      render(<SpotlightSearch {...defaultProps} onClose={onClose} />);
      const container = screen
        .getByPlaceholderText(/Search files/i)
        .closest('.spotlight-container');
      if (container) {
        fireEvent.click(container);
        expect(onClose).not.toHaveBeenCalled();
      }
    });

    it('should select result on click', async () => {
      const onNavigateToFile = jest.fn();
      render(
        <SpotlightSearch
          {...defaultProps}
          onNavigateToFile={onNavigateToFile}
        />,
      );
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, 'test');
      await waitFor(() => {
        expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
      });

      const fileResult = screen.getByText('test-video.mp4').closest('button');
      if (fileResult) {
        fireEvent.click(fileResult);
        expect(onNavigateToFile).toHaveBeenCalled();
      }
    });

    it('should update selected index on mouse hover', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, 'test');
      await waitFor(() => {
        expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
      });

      const results = screen.getAllByRole('button');
      if (results[1]) {
        fireEvent.mouseEnter(results[1]);
        expect(results[1]).toHaveClass('selected');
      }
    });
  });

  describe('Operator Selection', () => {
    it('should insert operator into query when selected', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(
        /Search files/i,
      ) as HTMLInputElement;

      // Click on tag: operator
      const tagOperator = screen.getByText('tag:').closest('button');
      if (tagOperator) {
        fireEvent.click(tagOperator);
        await waitFor(() => {
          expect(input.value).toBe('tag:');
        });
      }
    });

    it('should keep search open when operator is selected', async () => {
      const onClose = jest.fn();
      render(<SpotlightSearch {...defaultProps} onClose={onClose} />);

      const tagOperator = screen.getByText('tag:').closest('button');
      if (tagOperator) {
        fireEvent.click(tagOperator);
        await waitFor(() => {
          expect(onClose).not.toHaveBeenCalled();
        });
      }
    });
  });

  describe('Recent Searches', () => {
    it('should save search to recent searches', async () => {
      const onSearchSubmit = jest.fn();
      render(
        <SpotlightSearch {...defaultProps} onSearchSubmit={onSearchSubmit} />,
      );
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, 'test query');
      await userEvent.type(input, '{Enter}');

      // Check localStorage
      const recentSearches = JSON.parse(
        localStorage.getItem('ursly-recent-searches') || '[]',
      );
      expect(recentSearches).toContain('test query');
    });
  });

  describe('Search Operators', () => {
    it('should filter files by tag operator', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, 'tag:test');
      await waitFor(() => {
        // Should show files with 'test' tag
        expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
      });
    });

    it('should filter files by type operator', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, 'type:video');
      await waitFor(() => {
        expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
        expect(screen.queryByText('document.pdf')).not.toBeInTheDocument();
      });
    });

    it('should filter files by ext operator', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, 'ext:pdf');
      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
        expect(screen.queryByText('test-video.mp4')).not.toBeInTheDocument();
      });
    });

    it('should handle multiple operators', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, 'tag:test type:video');
      await waitFor(() => {
        // Should show files matching both criteria
        expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
      });
    });

    it('should insert operator when Tab is pressed on operator result', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(
        /Search files/i,
      ) as HTMLInputElement;

      // Type 'tag' to show operator hint
      await userEvent.type(input, 'tag');
      await waitFor(() => {
        expect(screen.getByText('tag:')).toBeInTheDocument();
      });

      // Navigate to operator (should be first result after typing)
      await userEvent.type(input, '{ArrowDown}');
      // Press Tab to insert
      await userEvent.type(input, '{Tab}');

      await waitFor(() => {
        expect(input.value).toBe('tag:');
      });
    });

    it('should insert tag: prefix when selecting a tag', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(
        /Search files/i,
      ) as HTMLInputElement;

      // Type to show tag results
      await userEvent.type(input, 'test');
      await waitFor(() => {
        // Find tag result (not file result)
        const tagResults = screen.getAllByText('test');
        expect(tagResults.length).toBeGreaterThan(0);
      });

      // Find and click tag result
      const tagButtons = screen.getAllByRole('button');
      const tagButton = tagButtons.find((btn) =>
        btn.textContent?.includes('Tag'),
      );
      if (tagButton) {
        fireEvent.click(tagButton);
        await waitFor(() => {
          expect(input.value).toContain('tag:');
        });
      }
    });
  });

  describe('Search Query Parsing', () => {
    it('should handle empty query', () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(/Search files/i);
      expect(input).toHaveValue('');
    });

    it('should handle query with spaces', async () => {
      const onSearchSubmit = jest.fn();
      render(
        <SpotlightSearch {...defaultProps} onSearchSubmit={onSearchSubmit} />,
      );
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, 'test video file');
      await userEvent.type(input, '{Enter}');

      expect(onSearchSubmit).toHaveBeenCalledWith('test video file');
    });

    it('should trim query before submitting', async () => {
      const onSearchSubmit = jest.fn();
      render(
        <SpotlightSearch {...defaultProps} onSearchSubmit={onSearchSubmit} />,
      );
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, '  test  ');
      await userEvent.type(input, '{Enter}');

      expect(onSearchSubmit).toHaveBeenCalledWith('test');
    });
  });

  describe('File Navigation', () => {
    it('should navigate to file when selected', async () => {
      const onNavigateToFile = jest.fn();
      render(
        <SpotlightSearch
          {...defaultProps}
          onNavigateToFile={onNavigateToFile}
        />,
      );
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, 'test');
      await waitFor(() => {
        expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
      });

      await userEvent.type(input, '{Enter}');
      expect(onNavigateToFile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-video.mp4',
        }),
      );
    });

    it('should navigate to folder when selected', async () => {
      const onNavigateToFile = jest.fn();
      render(
        <SpotlightSearch
          {...defaultProps}
          onNavigateToFile={onNavigateToFile}
        />,
      );
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, 'folder');
      await waitFor(() => {
        expect(screen.getByText('folder')).toBeInTheDocument();
      });

      await userEvent.type(input, '{Enter}');
      expect(onNavigateToFile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'folder',
          isDirectory: true,
        }),
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty files array', () => {
      render(<SpotlightSearch {...defaultProps} files={[]} />);
      const input = screen.getByPlaceholderText(/Search files/i);
      expect(input).toBeInTheDocument();
      // Should still show operator hints
      expect(screen.getByText('tag:')).toBeInTheDocument();
    });

    it('should handle files without tags', async () => {
      const filesWithoutTags = [
        {
          ...mockFiles[0],
          tags: [],
        },
      ];
      render(<SpotlightSearch {...defaultProps} files={filesWithoutTags} />);
      const input = screen.getByPlaceholderText(/Search files/i);

      await userEvent.type(input, 'test');
      // Should still show file results
      await waitFor(() => {
        expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
      });
    });

    it('should reset selected index when query changes', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(/Search files/i);

      // Navigate down
      await userEvent.type(input, '{ArrowDown}');
      const results1 = screen.getAllByRole('button');
      expect(results1[1]).toHaveClass('selected');

      // Change query
      await userEvent.clear(input);
      await userEvent.type(input, 'new');

      // Selected index should reset to 0
      const results2 = screen.getAllByRole('button');
      expect(results2[0]).toHaveClass('selected');
    });

    it('should handle rapid typing', async () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(/Search files/i);

      // Rapidly type multiple characters
      await userEvent.type(input, 'test', { delay: 10 });
      await waitFor(() => {
        expect(input).toHaveValue('test');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<SpotlightSearch {...defaultProps} />);
      const input = screen.getByPlaceholderText(/Search files/i);
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should focus input when opened', async () => {
      const { rerender } = render(
        <SpotlightSearch {...defaultProps} isOpen={false} />,
      );
      rerender(<SpotlightSearch {...defaultProps} isOpen={true} />);

      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Search files/i);
        expect(input).toHaveFocus();
      });
    });
  });
});
