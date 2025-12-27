/**
 * AddStorageModal - Dynamic storage source configuration
 *
 * Allows users to add any supported storage type:
 * - Cloud: S3, GCS, Azure, MinIO, Wasabi, etc.
 * - Network: NFS, SMB/CIFS, WebDAV, SFTP
 * - Hybrid: FSx ONTAP, NetApp
 * - Custom: User-defined providers
 */
import React, { useState, useCallback } from 'react';
import { StorageCategory, StorageSource } from '../../types/storage';
import {
  IconCloud,
  IconNetwork,
  IconDatabase,
  IconCube,
  IconServer,
  IconFolder,
  IconLink,
} from '../CyberpunkIcons';
import './AddStorageModal.css';

interface AddStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (source: Partial<StorageSource>) => void;
}

// Helper to get provider icon component
const getProviderIcon = (providerId: string) => {
  const iconProps = { size: 24, color: 'currentColor' };
  switch (providerId) {
    case 's3':
    case 'gcs':
    case 'azure-blob':
    case 's3-compatible':
      return <IconCloud {...iconProps} />;
    case 'smb':
    case 'nfs':
      return <IconFolder {...iconProps} />;
    case 'sftp':
      return <IconServer {...iconProps} />;
    case 'webdav':
      return <IconLink {...iconProps} />;
    case 'fsx-ontap':
    case 'netapp':
      return <IconDatabase {...iconProps} />;
    case 'iscsi':
    case 'fc':
      return <IconCube {...iconProps} />;
    default:
      return <IconServer {...iconProps} />;
  }
};

// Storage provider templates (simplified - backend has full schema)
const PROVIDER_TEMPLATES = [
  {
    category: 'cloud' as StorageCategory,
    providers: [
      { id: 's3', name: 'Amazon S3' },
      { id: 'gcs', name: 'Google Cloud Storage' },
      { id: 'azure-blob', name: 'Azure Blob Storage' },
      {
        id: 's3-compatible',
        name: 'S3 Compatible',
        description: 'MinIO, Wasabi, R2, etc.',
      },
    ],
  },
  {
    category: 'network' as StorageCategory,
    providers: [
      { id: 'smb', name: 'SMB/CIFS Share' },
      { id: 'nfs', name: 'NFS Mount' },
      { id: 'sftp', name: 'SFTP Server' },
      { id: 'webdav', name: 'WebDAV' },
    ],
  },
  {
    category: 'hybrid' as StorageCategory,
    providers: [
      { id: 'fsx-ontap', name: 'FSx for ONTAP' },
      { id: 'netapp', name: 'NetApp' },
    ],
  },
  {
    category: 'block' as StorageCategory,
    providers: [
      { id: 'iscsi', name: 'iSCSI Target' },
      { id: 'fc', name: 'Fibre Channel' },
    ],
  },
];

// Config fields per provider (subset - full validation on backend)
const PROVIDER_FIELDS: Record<
  string,
  {
    key: string;
    label: string;
    type: string;
    required: boolean;
    placeholder?: string;
  }[]
> = {
  s3: [
    {
      key: 'bucket',
      label: 'Bucket Name',
      type: 'text',
      required: true,
      placeholder: 'my-bucket',
    },
    {
      key: 'region',
      label: 'Region',
      type: 'text',
      required: true,
      placeholder: 'us-east-1',
    },
    {
      key: 'accessKeyId',
      label: 'Access Key ID',
      type: 'text',
      required: false,
      placeholder: 'Optional - uses IAM if empty',
    },
    {
      key: 'secretAccessKey',
      label: 'Secret Access Key',
      type: 'password',
      required: false,
    },
  ],
  gcs: [
    {
      key: 'bucket',
      label: 'Bucket Name',
      type: 'text',
      required: true,
      placeholder: 'my-gcs-bucket',
    },
    { key: 'projectId', label: 'Project ID', type: 'text', required: true },
  ],
  'azure-blob': [
    { key: 'container', label: 'Container Name', type: 'text', required: true },
    {
      key: 'accountName',
      label: 'Storage Account',
      type: 'text',
      required: true,
    },
    {
      key: 'accountKey',
      label: 'Account Key',
      type: 'password',
      required: false,
      placeholder: 'Optional - uses managed identity',
    },
  ],
  's3-compatible': [
    {
      key: 'endpoint',
      label: 'Endpoint URL',
      type: 'text',
      required: true,
      placeholder: 'https://s3.example.com',
    },
    { key: 'bucket', label: 'Bucket Name', type: 'text', required: true },
    { key: 'accessKeyId', label: 'Access Key', type: 'text', required: true },
    {
      key: 'secretAccessKey',
      label: 'Secret Key',
      type: 'password',
      required: true,
    },
  ],
  smb: [
    {
      key: 'server',
      label: 'Server',
      type: 'text',
      required: true,
      placeholder: 'fileserver.local',
    },
    {
      key: 'share',
      label: 'Share Name',
      type: 'text',
      required: true,
      placeholder: 'media',
    },
    { key: 'username', label: 'Username', type: 'text', required: false },
    { key: 'password', label: 'Password', type: 'password', required: false },
  ],
  nfs: [
    {
      key: 'server',
      label: 'Server',
      type: 'text',
      required: true,
      placeholder: 'nfs.local',
    },
    {
      key: 'export',
      label: 'Export Path',
      type: 'text',
      required: true,
      placeholder: '/exports/media',
    },
  ],
  sftp: [
    {
      key: 'host',
      label: 'Host',
      type: 'text',
      required: true,
      placeholder: 'sftp.example.com',
    },
    {
      key: 'port',
      label: 'Port',
      type: 'text',
      required: false,
      placeholder: '22',
    },
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: false },
  ],
  webdav: [
    {
      key: 'url',
      label: 'WebDAV URL',
      type: 'text',
      required: true,
      placeholder: 'https://dav.example.com/files',
    },
    { key: 'username', label: 'Username', type: 'text', required: false },
    { key: 'password', label: 'Password', type: 'password', required: false },
  ],
  'fsx-ontap': [
    {
      key: 'endpoint',
      label: 'Management Endpoint',
      type: 'text',
      required: true,
    },
    { key: 'volumePath', label: 'Volume Path', type: 'text', required: true },
  ],
  netapp: [
    { key: 'server', label: 'NetApp Server', type: 'text', required: true },
    { key: 'volume', label: 'Volume', type: 'text', required: true },
  ],
  iscsi: [
    { key: 'target', label: 'iSCSI Target', type: 'text', required: true },
    { key: 'portal', label: 'Portal Address', type: 'text', required: true },
  ],
  fc: [
    { key: 'wwnn', label: 'WWNN', type: 'text', required: true },
    { key: 'lun', label: 'LUN', type: 'text', required: true },
  ],
};

const getCategoryIcon = (category: StorageCategory) => {
  const iconProps = { size: 20, color: 'currentColor', glow: true };
  switch (category) {
    case 'cloud':
      return <IconCloud {...iconProps} />;
    case 'network':
      return <IconNetwork {...iconProps} />;
    case 'hybrid':
      return <IconDatabase {...iconProps} />;
    case 'block':
      return <IconCube {...iconProps} />;
    default:
      return <IconServer {...iconProps} />;
  }
};

export const AddStorageModal: React.FC<AddStorageModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<StorageCategory | null>(null);
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Debug logging
  React.useEffect(() => {
    if (isOpen) {
      console.log('[AddStorageModal] Modal opened');
    }
  }, [isOpen]);

  // Handle paste events - support both native and cross-app pastes
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLInputElement>, fieldKey?: string) => {
      try {
        // First try to read from clipboard event (works for native pastes)
        let pastedText =
          e.clipboardData.getData('text/plain') ||
          e.clipboardData.getData('text');

        // If clipboard event has data, let native paste work normally
        if (pastedText && pastedText.trim()) {
          // Don't prevent default - let native paste work
          // Just sync our state after native paste completes
          const trimmedText = pastedText.trim();
          setTimeout(() => {
            if (fieldKey) {
              setConfig((prev) => ({ ...prev, [fieldKey]: trimmedText }));
            } else {
              setName(trimmedText);
            }
          }, 0);
          return; // Native paste will handle it
        }

        // No data in clipboard event - need to use clipboard API (cross-app paste)
        e.preventDefault();
        e.stopPropagation();

        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            pastedText = await navigator.clipboard.readText();
            if (pastedText && pastedText.trim()) {
              const trimmedText = pastedText.trim();
              if (fieldKey) {
                setConfig((prev) => ({ ...prev, [fieldKey]: trimmedText }));
              } else {
                setName(trimmedText);
              }
            }
          }
        } catch (clipboardErr) {
          console.warn(
            '[AddStorageModal] Clipboard API not available:',
            clipboardErr,
          );
          // Let browser handle paste normally if all else fails
        }
      } catch (err) {
        console.error('[AddStorageModal] Error handling paste:', err);
        // Don't prevent default on error - let native paste work
      }
    },
    [],
  );

  if (!isOpen) return null;

  const handleProviderSelect = (
    providerId: string,
    category: StorageCategory,
  ) => {
    setSelectedProvider(providerId);
    setSelectedCategory(category);
    setStep('configure');
    setConfig({});
    setError(null);
  };

  const handleBack = () => {
    setStep('select');
    setSelectedProvider(null);
    setError(null);
  };

  const handleSubmit = () => {
    if (!selectedProvider || !selectedCategory) return;

    const fields = PROVIDER_FIELDS[selectedProvider] || [];
    const missingRequired = fields.filter((f) => f.required && !config[f.key]);

    if (missingRequired.length > 0) {
      setError(
        `Missing required fields: ${missingRequired.map((f) => f.label).join(', ')}`,
      );
      return;
    }

    if (!name.trim()) {
      setError('Please enter a display name');
      return;
    }

    const source: Partial<StorageSource> = {
      id: `${selectedProvider}-${Date.now()}`,
      name: name.trim(),
      providerId: selectedProvider,
      category: selectedCategory,
      config,
      status: 'disconnected',
    };

    onAdd(source);
    handleClose();
  };

  const handleClose = () => {
    try {
      setStep('select');
      setSelectedProvider(null);
      setSelectedCategory(null);
      setName('');
      setConfig({});
      setError(null);
      onClose();
    } catch (err) {
      console.error('[AddStorageModal] Error closing modal:', err);
      onClose(); // Still try to close
    }
  };

  const fields = selectedProvider
    ? PROVIDER_FIELDS[selectedProvider] || []
    : [];
  const providerName =
    PROVIDER_TEMPLATES.flatMap((g) => g.providers).find(
      (p) => p.id === selectedProvider,
    )?.name || 'Storage';

  return (
    <div
      className="add-storage-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-storage-title"
    >
      <div className="add-storage-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="add-storage-title">
            {step === 'select' ? 'Add Storage' : `Configure ${providerName}`}
          </h2>
          <button className="close-btn" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          {step === 'select' && (
            <div className="provider-grid">
              {PROVIDER_TEMPLATES.map((group) => (
                <div key={group.category} className="provider-group">
                  <div className="group-header">
                    {getCategoryIcon(group.category)}
                    <span>
                      {group.category.charAt(0).toUpperCase() +
                        group.category.slice(1)}
                    </span>
                  </div>
                  <div className="group-providers">
                    {group.providers.map((provider) => (
                      <button
                        key={provider.id}
                        className="provider-btn"
                        onClick={() =>
                          handleProviderSelect(provider.id, group.category)
                        }
                      >
                        <span className="provider-icon">
                          {getProviderIcon(provider.id)}
                        </span>
                        <span className="provider-name">{provider.name}</span>
                        {provider.description && (
                          <span className="provider-desc">
                            {provider.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 'configure' && (
            <div className="config-form">
              <div className="form-field">
                <label htmlFor="display-name">Display Name *</label>
                <input
                  id="display-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onPaste={(e) => {
                    handlePaste(e).catch((err) => {
                      console.error(
                        '[AddStorageModal] Paste handler error:',
                        err,
                      );
                    });
                  }}
                  onKeyDown={(e) => handleKeyboardPaste(e)}
                  placeholder={`My ${providerName}`}
                />
              </div>

              {fields.map((field) => (
                <div key={field.key} className="form-field">
                  <label htmlFor={`field-${field.key}`}>
                    {field.label}
                    {field.required && ' *'}
                  </label>
                  <input
                    id={`field-${field.key}`}
                    type={field.type === 'password' ? 'password' : 'text'}
                    value={config[field.key] || ''}
                    onChange={(e) =>
                      setConfig({ ...config, [field.key]: e.target.value })
                    }
                    onPaste={(e) => {
                      handlePaste(e, field.key).catch((err) => {
                        console.error(
                          '[AddStorageModal] Paste handler error:',
                          err,
                        );
                      });
                    }}
                    onKeyDown={(e) => handleKeyboardPaste(e, field.key)}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}

              {error && <div className="form-error">{error}</div>}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step === 'configure' && (
            <button className="back-btn" onClick={handleBack}>
              Back
            </button>
          )}
          <div className="footer-spacer" />
          <button className="cancel-btn" onClick={handleClose}>
            Cancel
          </button>
          {step === 'configure' && (
            <button className="add-btn" onClick={handleSubmit}>
              Add Storage
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddStorageModal;
