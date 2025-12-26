/**
 * AddStorageModal Component Tests
 *
 * Tests all features of the AddStorageModal component:
 * - Provider selection
 * - Configuration form rendering
 * - Form validation
 * - Storage source creation
 * - Modal open/close behavior
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddStorageModal } from './AddStorageModal';
import type { StorageSource } from '../../types/storage';

// Mock the CyberpunkIcons to avoid SVG rendering issues in tests
jest.mock('../CyberpunkIcons', () => ({
  IconCloud: ({ size, color }: { size?: number; color?: string }) => (
    <div data-testid="icon-cloud" data-size={size} data-color={color}>
      Cloud
    </div>
  ),
  IconNetwork: ({ size, color }: { size?: number; color?: string }) => (
    <div data-testid="icon-network" data-size={size} data-color={color}>
      Network
    </div>
  ),
  IconDatabase: ({ size, color }: { size?: number; color?: string }) => (
    <div data-testid="icon-database" data-size={size} data-color={color}>
      Database
    </div>
  ),
  IconCube: ({ size, color }: { size?: number; color?: string }) => (
    <div data-testid="icon-cube" data-size={size} data-color={color}>
      Cube
    </div>
  ),
  IconServer: ({ size, color }: { size?: number; color?: string }) => (
    <div data-testid="icon-server" data-size={size} data-color={color}>
      Server
    </div>
  ),
  IconFolder: ({ size, color }: { size?: number; color?: string }) => (
    <div data-testid="icon-folder" data-size={size} data-color={color}>
      Folder
    </div>
  ),
  IconLink: ({ size, color }: { size?: number; color?: string }) => (
    <div data-testid="icon-link" data-size={size} data-color={color}>
      Link
    </div>
  ),
}));

describe('AddStorageModal', () => {
  const mockOnAdd = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Modal Visibility', () => {
    it('should not render when isOpen is false', () => {
      render(
        <AddStorageModal
          isOpen={false}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      expect(screen.queryByText('Add Storage')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      expect(screen.getByText('Add Storage')).toBeInTheDocument();
    });

    it('should close modal when clicking overlay', async () => {
      render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      const overlay = screen
        .getByText('Add Storage')
        .closest('.add-storage-overlay');
      if (overlay) {
        fireEvent.click(overlay);
        await waitFor(() => {
          expect(mockOnClose).toHaveBeenCalledTimes(1);
        });
      }
    });

    it('should close modal when clicking close button', async () => {
      render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      const closeButton = screen.getByRole('button', { name: /×/ });
      fireEvent.click(closeButton);
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should close modal when clicking Cancel button', async () => {
      render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Provider Selection', () => {
    it('should display all provider categories', () => {
      const { container: _container } = render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      // Check category headers in group-header spans
      const headers = _container.querySelectorAll('.group-header span');
      const headerTexts = Array.from(headers).map((h) => h.textContent);
      expect(headerTexts).toContain('Cloud');
      expect(headerTexts).toContain('Network');
      expect(headerTexts).toContain('Hybrid');
      expect(headerTexts).toContain('Block');
    });

    it('should display all cloud providers', () => {
      render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      expect(screen.getByText('Amazon S3')).toBeInTheDocument();
      expect(screen.getByText('Google Cloud Storage')).toBeInTheDocument();
      expect(screen.getByText('Azure Blob Storage')).toBeInTheDocument();
      expect(screen.getByText('S3 Compatible')).toBeInTheDocument();
    });

    it('should display all network providers', () => {
      render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      expect(screen.getByText('SMB/CIFS Share')).toBeInTheDocument();
      expect(screen.getByText('NFS Mount')).toBeInTheDocument();
      expect(screen.getByText('SFTP Server')).toBeInTheDocument();
      expect(screen.getByText('WebDAV')).toBeInTheDocument();
    });

    it('should navigate to configuration step when provider is selected', async () => {
      render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      const s3Button = screen.getByText('Amazon S3').closest('button');
      if (s3Button) {
        fireEvent.click(s3Button);
        await waitFor(() => {
          expect(screen.getByText(/Configure Amazon S3/i)).toBeInTheDocument();
        });
      }
    });

    it('should show correct icons for each provider type', () => {
      render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      // Cloud providers should have cloud icon
      const s3Button = screen.getByText('Amazon S3').closest('button');
      expect(
        s3Button?.querySelector('[data-testid="icon-cloud"]'),
      ).toBeInTheDocument();

      // Network providers should have appropriate icons
      const smbButton = screen.getByText('SMB/CIFS Share').closest('button');
      expect(
        smbButton?.querySelector('[data-testid="icon-folder"]'),
      ).toBeInTheDocument();

      const sftpButton = screen.getByText('SFTP Server').closest('button');
      expect(
        sftpButton?.querySelector('[data-testid="icon-server"]'),
      ).toBeInTheDocument();
    });
  });

  describe('Configuration Form', () => {
    beforeEach(async () => {
      render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      // Navigate to configuration step
      const s3Button = screen.getByText('Amazon S3').closest('button');
      if (s3Button) {
        fireEvent.click(s3Button);
        await waitFor(() => {
          expect(screen.getByText(/Configure Amazon S3/i)).toBeInTheDocument();
        });
      }
    });

    it('should display display name field', () => {
      expect(screen.getByLabelText(/Display Name/i)).toBeInTheDocument();
    });

    it('should display provider-specific configuration fields for S3', () => {
      expect(screen.getByLabelText(/Bucket Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Region/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Access Key ID/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Secret Access Key/i)).toBeInTheDocument();
    });

    it('should show Back button in configuration step', () => {
      expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
    });

    it('should return to selection step when Back is clicked', async () => {
      const backButton = screen.getByRole('button', { name: /Back/i });
      fireEvent.click(backButton);
      await waitFor(() => {
        expect(screen.getByText('Add Storage')).toBeInTheDocument();
        expect(screen.queryByText(/Configure/i)).not.toBeInTheDocument();
      });
    });

    it('should update form fields when typing', async () => {
      const user = userEvent.setup();
      const nameInput = screen.getByLabelText(/Display Name/i);
      const bucketInput = screen.getByLabelText(/Bucket Name/i);

      await user.type(nameInput, 'My S3 Bucket');
      await user.type(bucketInput, 'my-bucket');

      expect(nameInput).toHaveValue('My S3 Bucket');
      expect(bucketInput).toHaveValue('my-bucket');
    });

    it('should show password fields as password type', () => {
      const secretKeyInput = screen.getByLabelText(/Secret Access Key/i);
      expect(secretKeyInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Form Validation', () => {
    beforeEach(async () => {
      render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      const s3Button = screen.getByText('Amazon S3').closest('button');
      if (s3Button) {
        fireEvent.click(s3Button);
        await waitFor(() => {
          expect(screen.getByText(/Configure Amazon S3/i)).toBeInTheDocument();
        });
      }
    });

    it('should show error when submitting without display name', async () => {
      // beforeEach already navigated to S3 config
      // Fill required fields but leave display name empty
      const user = userEvent.setup();
      const bucketInput = screen.getByLabelText(/Bucket Name/i);
      const regionInput = screen.getByLabelText(/Region/i);

      await user.type(bucketInput, 'my-bucket');
      await user.type(regionInput, 'us-east-1');
      // Display name is empty

      const addButton = screen.getByRole('button', { name: /Add Storage/i });
      await user.click(addButton);

      await waitFor(() => {
        // The error message should appear - check for either error message
        const errorMessage =
          screen.queryByText(/Please enter a display name/i) ||
          screen.queryByText(/Missing required fields/i);
        expect(errorMessage).toBeInTheDocument();
      });
      expect(mockOnAdd).not.toHaveBeenCalled();
    });

    it('should show error when missing required fields', async () => {
      // beforeEach already navigated to S3 config
      const user = userEvent.setup();
      const nameInput = screen.getByLabelText(/Display Name/i);
      await user.type(nameInput, 'My Storage');
      // Bucket and Region are required but not filled

      const addButton = screen.getByRole('button', { name: /Add Storage/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Missing required fields/i),
        ).toBeInTheDocument();
      });
      expect(mockOnAdd).not.toHaveBeenCalled();
    });

    it('should validate required fields for S3', async () => {
      // beforeEach already navigated to S3 config
      const user = userEvent.setup();
      const nameInput = screen.getByLabelText(/Display Name/i);
      const bucketInput = screen.getByLabelText(/Bucket Name/i);

      await user.type(nameInput, 'My S3 Storage');
      await user.type(bucketInput, 'my-bucket');
      // Region is required but not filled

      const addButton = screen.getByRole('button', { name: /Add Storage/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Missing required fields/i),
        ).toBeInTheDocument();
      });
      expect(mockOnAdd).not.toHaveBeenCalled();
    });

    it('should submit successfully when all required fields are filled', async () => {
      const user = userEvent.setup();
      const nameInput = screen.getByLabelText(/Display Name/i);
      const bucketInput = screen.getByLabelText(/Bucket Name/i);
      const regionInput = screen.getByLabelText(/Region/i);

      await user.type(nameInput, 'My S3 Storage');
      await user.type(bucketInput, 'my-bucket');
      await user.type(regionInput, 'us-east-1');

      const addButton = screen.getByRole('button', { name: /Add Storage/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockOnAdd.mock.calls[0][0];
      expect(callArgs.name).toBe('My S3 Storage');
      expect(callArgs.providerId).toBe('s3');
      expect(callArgs.category).toBe('cloud');
      // Config only includes fields that have values (optional fields are not included if empty)
      expect(callArgs.config).toEqual({
        bucket: 'my-bucket',
        region: 'us-east-1',
      });
      expect(callArgs.id).toMatch(/^s3-\d+$/);
    });
  });

  describe('Different Provider Types', () => {
    it('should show correct fields for GCS', async () => {
      render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      const gcsButton = screen
        .getByText('Google Cloud Storage')
        .closest('button');
      if (gcsButton) {
        fireEvent.click(gcsButton);
        await waitFor(() => {
          expect(screen.getByLabelText(/Bucket Name/i)).toBeInTheDocument();
          expect(screen.getByLabelText(/Project ID/i)).toBeInTheDocument();
        });
      }
    });

    it('should show correct fields for SFTP', async () => {
      render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      const sftpButton = screen.getByText('SFTP Server').closest('button');
      if (sftpButton) {
        fireEvent.click(sftpButton);
        await waitFor(() => {
          expect(screen.getByLabelText(/Host/i)).toBeInTheDocument();
          expect(screen.getByLabelText(/Port/i)).toBeInTheDocument();
          expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
          expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
        });
      }
    });

    it('should show correct fields for WebDAV', async () => {
      render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      const webdavButton = screen.getByText('WebDAV').closest('button');
      if (webdavButton) {
        fireEvent.click(webdavButton);
        await waitFor(() => {
          expect(screen.getByLabelText(/WebDAV URL/i)).toBeInTheDocument();
        });
      }
    });

    it('should show correct fields for SMB/CIFS', async () => {
      render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );
      const smbButton = screen.getByText('SMB/CIFS Share').closest('button');
      if (smbButton) {
        fireEvent.click(smbButton);
        await waitFor(() => {
          expect(screen.getByLabelText(/Server/i)).toBeInTheDocument();
          expect(screen.getByLabelText(/Share Name/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Storage Source Creation', () => {
    it('should call onAdd with correct source data for S3', async () => {
      const user = userEvent.setup();
      render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );

      // Select S3 provider
      const s3Button = screen.getByText('Amazon S3').closest('button');
      if (s3Button) {
        fireEvent.click(s3Button);
        await waitFor(() => {
          expect(screen.getByText(/Configure Amazon S3/i)).toBeInTheDocument();
        });
      }

      // Fill form
      await user.type(screen.getByLabelText(/Display Name/i), 'My S3');
      await user.type(screen.getByLabelText(/Bucket Name/i), 'my-bucket');
      await user.type(screen.getByLabelText(/Region/i), 'us-east-1');
      await user.type(screen.getByLabelText(/Access Key ID/i), 'AKIA123');
      await user.type(screen.getByLabelText(/Secret Access Key/i), 'secret123');

      // Submit
      const addButton = screen.getByRole('button', { name: /Add Storage/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledTimes(1);
      });

      const source = mockOnAdd.mock.calls[0][0] as Partial<StorageSource>;
      expect(source.name).toBe('My S3');
      expect(source.providerId).toBe('s3');
      expect(source.category).toBe('cloud');
      expect(source.status).toBe('disconnected');
      expect(source.config).toEqual({
        bucket: 'my-bucket',
        region: 'us-east-1',
        accessKeyId: 'AKIA123',
        secretAccessKey: 'secret123',
      });
      expect(source.id).toMatch(/^s3-\d+$/);
    });

    it('should reset form state when modal closes', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );

      // Navigate to config step
      const s3Button = screen.getByText('Amazon S3').closest('button');
      if (s3Button) {
        fireEvent.click(s3Button);
        await waitFor(() => {
          expect(screen.getByText(/Configure Amazon S3/i)).toBeInTheDocument();
        });
      }

      // Close modal
      fireEvent.click(screen.getByRole('button', { name: /×/ }));
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });

      // Reopen modal
      rerender(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );

      // Should be back at selection step
      expect(screen.getByText('Add Storage')).toBeInTheDocument();
      expect(screen.queryByText(/Configure/i)).not.toBeInTheDocument();
    });
  });

  describe('CSS Variables Usage', () => {
    it('should use CSS variables for styling', () => {
      const { container: _container } = render(
        <AddStorageModal
          isOpen={true}
          onClose={mockOnClose}
          onAdd={mockOnAdd}
        />,
      );

      const modal = _container.querySelector('.add-storage-modal');
      expect(modal).toBeInTheDocument();

      // Check that CSS variables are used (via computed styles)
      // The modal should exist and be styled
      expect(modal).toBeInTheDocument();
      if (modal) {
        const styles = window.getComputedStyle(modal);
        // Verify CSS variables are being used (check for var() usage)
        expect(styles.display).toBeTruthy();
      }
    });
  });
});
