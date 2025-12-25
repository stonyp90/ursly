/**
 * Storage Types for Virtual File System
 *
 * Dynamic provider system that supports any cloud, on-prem, or local storage.
 * New providers can be registered at runtime without code changes.
 */

// =============================================================================
// Storage Provider Categories (extensible)
// =============================================================================

export type StorageCategory =
  | 'local' // Local filesystem
  | 'cloud' // Cloud object storage (S3, GCS, Azure Blob, etc.)
  | 'block' // Block storage (EBS, Azure Disk, FSx, etc.)
  | 'network' // Network shares (NFS, SMB, CIFS, AFP)
  | 'hybrid' // Hybrid solutions (FSx ONTAP, NetApp, etc.)
  | 'custom'; // User-defined / plugins

// =============================================================================
// Dynamic Storage Provider Definition
// =============================================================================

/**
 * Storage provider definition - can be extended at runtime
 * Examples: AWS S3, Google Cloud Storage, Azure Blob, MinIO, Wasabi, etc.
 */
export interface StorageProviderDefinition {
  /** Unique provider ID (e.g., 'aws-s3', 'gcs', 'azure-blob') */
  id: string;

  /** Display name */
  name: string;

  /** Provider category */
  category: StorageCategory;

  /** Provider icon (lucide icon name or custom SVG) */
  icon?: string;

  /** Description */
  description?: string;

  /** Required configuration fields */
  configSchema: StorageConfigField[];

  /** Optional features supported */
  features?: StorageProviderFeatures;

  /** Is this a built-in provider or user-registered */
  builtIn?: boolean;
}

/**
 * Configuration field for storage providers
 */
export interface StorageConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'number' | 'boolean' | 'path';
  required: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: { value: string; label: string }[]; // For select type
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    message?: string;
  };
}

/**
 * Features a storage provider can support
 */
export interface StorageProviderFeatures {
  /** Supports data tiering (hot/warm/cold) */
  tiering?: boolean;

  /** Supports versioning */
  versioning?: boolean;

  /** Supports encryption at rest */
  encryption?: boolean;

  /** Supports access control lists */
  acl?: boolean;

  /** Supports presigned URLs */
  presignedUrls?: boolean;

  /** Supports multipart upload */
  multipartUpload?: boolean;

  /** Read-only access */
  readOnly?: boolean;

  /** Supports thumbnails/previews */
  thumbnails?: boolean;

  /** Supports transcoding */
  transcoding?: boolean;
}

// =============================================================================
// Built-in Provider Registry
// =============================================================================

/**
 * Built-in storage providers - loaded by default
 * Users can register additional providers at runtime
 */
export const BUILTIN_PROVIDERS: StorageProviderDefinition[] = [
  // Local Filesystem
  {
    id: 'local',
    name: 'Local Filesystem',
    category: 'local',
    icon: 'hard-drive',
    description: 'Local disk storage',
    builtIn: true,
    configSchema: [
      {
        key: 'path',
        label: 'Path',
        type: 'path',
        required: true,
        placeholder: '/path/to/folder',
      },
    ],
    features: { thumbnails: true, transcoding: true },
  },

  // AWS S3
  {
    id: 'aws-s3',
    name: 'Amazon S3',
    category: 'cloud',
    icon: 'cloud',
    description: 'Amazon Simple Storage Service',
    builtIn: true,
    configSchema: [
      {
        key: 'bucket',
        label: 'Bucket',
        type: 'text',
        required: true,
        placeholder: 'my-bucket',
      },
      {
        key: 'region',
        label: 'Region',
        type: 'select',
        required: true,
        options: [
          { value: 'us-east-1', label: 'US East (N. Virginia)' },
          { value: 'us-west-2', label: 'US West (Oregon)' },
          { value: 'eu-west-1', label: 'EU (Ireland)' },
          { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
          // More regions can be added dynamically
        ],
      },
      {
        key: 'accessKeyId',
        label: 'Access Key ID',
        type: 'text',
        required: false,
      },
      {
        key: 'secretAccessKey',
        label: 'Secret Access Key',
        type: 'password',
        required: false,
      },
      {
        key: 'prefix',
        label: 'Prefix/Path',
        type: 'text',
        required: false,
        placeholder: 'optional/prefix/',
      },
    ],
    features: {
      tiering: true,
      versioning: true,
      encryption: true,
      presignedUrls: true,
      multipartUpload: true,
    },
  },

  // Google Cloud Storage
  {
    id: 'gcs',
    name: 'Google Cloud Storage',
    category: 'cloud',
    icon: 'cloud',
    description: 'Google Cloud Storage buckets',
    builtIn: true,
    configSchema: [
      { key: 'bucket', label: 'Bucket', type: 'text', required: true },
      { key: 'projectId', label: 'Project ID', type: 'text', required: true },
      {
        key: 'credentialsPath',
        label: 'Credentials JSON Path',
        type: 'path',
        required: false,
      },
      { key: 'prefix', label: 'Prefix/Path', type: 'text', required: false },
    ],
    features: { tiering: true, versioning: true, encryption: true },
  },

  // Azure Blob Storage
  {
    id: 'azure-blob',
    name: 'Azure Blob Storage',
    category: 'cloud',
    icon: 'cloud',
    description: 'Microsoft Azure Blob Storage',
    builtIn: true,
    configSchema: [
      {
        key: 'accountName',
        label: 'Storage Account',
        type: 'text',
        required: true,
      },
      { key: 'container', label: 'Container', type: 'text', required: true },
      {
        key: 'accessKey',
        label: 'Access Key',
        type: 'password',
        required: false,
      },
      {
        key: 'sasToken',
        label: 'SAS Token',
        type: 'password',
        required: false,
      },
      { key: 'prefix', label: 'Prefix/Path', type: 'text', required: false },
    ],
    features: { tiering: true, versioning: true, encryption: true },
  },

  // S3-Compatible (MinIO, Wasabi, Backblaze B2, etc.)
  {
    id: 's3-compatible',
    name: 'S3-Compatible Storage',
    category: 'cloud',
    icon: 'database',
    description: 'MinIO, Wasabi, Backblaze B2, DigitalOcean Spaces, etc.',
    builtIn: true,
    configSchema: [
      {
        key: 'endpoint',
        label: 'Endpoint URL',
        type: 'text',
        required: true,
        placeholder: 'https://s3.example.com',
      },
      { key: 'bucket', label: 'Bucket', type: 'text', required: true },
      {
        key: 'region',
        label: 'Region',
        type: 'text',
        required: false,
        defaultValue: 'auto',
      },
      {
        key: 'accessKeyId',
        label: 'Access Key ID',
        type: 'text',
        required: true,
      },
      {
        key: 'secretAccessKey',
        label: 'Secret Access Key',
        type: 'password',
        required: true,
      },
      {
        key: 'forcePathStyle',
        label: 'Force Path Style',
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
    ],
    features: { versioning: true, presignedUrls: true, multipartUpload: true },
  },

  // AWS FSx for NetApp ONTAP
  {
    id: 'fsx-ontap',
    name: 'FSx for NetApp ONTAP',
    category: 'hybrid',
    icon: 'server',
    description: 'AWS managed NetApp ONTAP with S3 tiering',
    builtIn: true,
    configSchema: [
      {
        key: 'volumePath',
        label: 'Volume Mount Path',
        type: 'path',
        required: true,
      },
      {
        key: 'svmEndpoint',
        label: 'SVM Management Endpoint',
        type: 'text',
        required: false,
      },
      {
        key: 's3AccessPoint',
        label: 'S3 Access Point ARN',
        type: 'text',
        required: false,
      },
    ],
    features: { tiering: true, thumbnails: true, transcoding: true },
  },

  // NFS
  {
    id: 'nfs',
    name: 'NFS Share',
    category: 'network',
    icon: 'network',
    description: 'Network File System mount',
    builtIn: true,
    configSchema: [
      {
        key: 'server',
        label: 'NFS Server',
        type: 'text',
        required: true,
        placeholder: 'nfs.example.com',
      },
      {
        key: 'export',
        label: 'Export Path',
        type: 'text',
        required: true,
        placeholder: '/exports/share',
      },
      {
        key: 'mountPoint',
        label: 'Local Mount Point',
        type: 'path',
        required: true,
      },
      {
        key: 'options',
        label: 'Mount Options',
        type: 'text',
        required: false,
        placeholder: 'rw,soft,timeo=30',
      },
    ],
    features: { thumbnails: true, transcoding: true },
  },

  // SMB/CIFS
  {
    id: 'smb',
    name: 'SMB/CIFS Share',
    category: 'network',
    icon: 'folder-open',
    description: 'Windows/Samba file share',
    builtIn: true,
    configSchema: [
      {
        key: 'server',
        label: 'Server',
        type: 'text',
        required: true,
        placeholder: '//server/share or \\\\server\\share',
      },
      { key: 'share', label: 'Share Name', type: 'text', required: true },
      { key: 'username', label: 'Username', type: 'text', required: false },
      { key: 'password', label: 'Password', type: 'password', required: false },
      { key: 'domain', label: 'Domain', type: 'text', required: false },
      {
        key: 'mountPoint',
        label: 'Local Mount Point',
        type: 'path',
        required: true,
      },
    ],
    features: { thumbnails: true, transcoding: true },
  },

  // WebDAV
  {
    id: 'webdav',
    name: 'WebDAV',
    category: 'network',
    icon: 'globe',
    description: 'Web Distributed Authoring and Versioning',
    builtIn: true,
    configSchema: [
      {
        key: 'url',
        label: 'WebDAV URL',
        type: 'text',
        required: true,
        placeholder: 'https://example.com/dav',
      },
      { key: 'username', label: 'Username', type: 'text', required: false },
      { key: 'password', label: 'Password', type: 'password', required: false },
    ],
    features: {},
  },

  // SFTP
  {
    id: 'sftp',
    name: 'SFTP',
    category: 'network',
    icon: 'shield',
    description: 'Secure File Transfer Protocol',
    builtIn: true,
    configSchema: [
      { key: 'host', label: 'Host', type: 'text', required: true },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        required: false,
        defaultValue: 22,
      },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: false },
      {
        key: 'privateKeyPath',
        label: 'Private Key Path',
        type: 'path',
        required: false,
      },
      {
        key: 'remotePath',
        label: 'Remote Path',
        type: 'text',
        required: false,
        defaultValue: '/',
      },
    ],
    features: {},
  },
];

// =============================================================================
// Storage Source Instance (runtime)
// =============================================================================

/**
 * A connected storage source instance
 */
export interface StorageSource {
  /** Unique instance ID */
  id: string;

  /** Display name */
  name: string;

  /** Provider ID (references StorageProviderDefinition.id) */
  providerId: string;

  /** Provider category (for quick filtering) */
  category: StorageCategory;

  /** Connection configuration (provider-specific) */
  config: Record<string, unknown>;

  /** Current connection status */
  status: 'connected' | 'connecting' | 'disconnected' | 'error';

  /** Error message if status is 'error' */
  error?: string;

  /** Is this source read-only */
  readOnly?: boolean;

  /** Last connected timestamp */
  lastConnected?: string;

  /** Storage tier status */
  tierStatus?: 'hot' | 'warm' | 'cold' | 'archive';

  /** Whether this is a mounted volume that can be ejected (DMG, external drive, etc.) */
  isEjectable?: boolean;

  /** Whether this is a system location (Home, Documents, etc.) - not ejectable */
  isSystemLocation?: boolean;

  // =========================================================================
  // Backward compatibility properties
  // =========================================================================

  /** @deprecated Use providerId instead - maps to provider type */
  type?: string;

  /** @deprecated Use status === 'connected' */
  connected?: boolean;

  /** @deprecated Use config.path */
  path?: string;

  /** @deprecated Use config.bucket */
  bucket?: string;

  /** @deprecated Use config.region */
  region?: string;
}

// =============================================================================
// File & Tier Types
// =============================================================================

export type FileTierStatus = 'hot' | 'warm' | 'cold' | 'nearline' | 'archive';

export interface FileMetadata {
  id: string;
  name: string;
  path: string;
  size: number;
  size_human?: string;
  lastModified: string;
  mimeType?: string;
  thumbnail?: string;

  isDirectory?: boolean;

  /** Is hidden file (starts with . on Unix, or has hidden attribute on Windows) */
  isHidden?: boolean;

  tierStatus: FileTierStatus;
  canWarm: boolean;
  isCached?: boolean;
  isWarmed?: boolean;

  canTranscode: boolean;
  transcodeStatus?: 'pending' | 'in_progress' | 'completed' | 'error';
  transcodeProgress?: number;

  // =========================================================================
  // Media Metadata (video/audio)
  // =========================================================================

  /** Video/audio duration in seconds */
  duration?: number;

  /** Video width in pixels */
  width?: number;

  /** Video height in pixels */
  height?: number;

  /** Frame rate (e.g., 23.976, 29.97, 60) */
  frameRate?: number;

  /** Video codec (e.g., 'h264', 'hevc', 'vp9', 'av1') */
  videoCodec?: string;

  /** Audio codec (e.g., 'aac', 'ac3', 'eac3', 'opus') */
  audioCodec?: string;

  /** Number of audio channels (e.g., 2, 6, 8) */
  audioChannels?: number;

  /** Audio sample rate in Hz (e.g., 44100, 48000) */
  audioSampleRate?: number;

  /** Audio bitrate in kbps */
  audioBitrate?: number;

  /** Video bitrate in kbps */
  videoBitrate?: number;

  /** Container format (e.g., 'mp4', 'mkv', 'mov') */
  container?: string;

  /** Color space (e.g., 'bt709', 'bt2020', 'p3') */
  colorSpace?: string;

  /** HDR format if applicable (e.g., 'hdr10', 'dolby_vision', 'hlg') */
  hdrFormat?: string;

  // =========================================================================
  // Extended Metadata
  // =========================================================================

  /** Custom tags (user-defined) */
  tags?: string[];

  /** Color label for organization */
  colorLabel?: string;

  /** User-defined comments/notes */
  comments?: string;

  /** Creation date (different from lastModified) */
  createdAt?: string;

  // =========================================================================
  // Organization Metadata (set by org defaults)
  // =========================================================================

  /** Project or campaign this asset belongs to */
  project?: string;

  /** Client name */
  client?: string;

  /** Department that owns this asset */
  department?: string;

  /** Asset category (e.g., 'raw', 'edit', 'final', 'archive', 'proxy') */
  assetCategory?: 'raw' | 'edit' | 'final' | 'archive' | 'proxy' | 'other';

  /** Usage rights or licensing info */
  usageRights?: string;

  /** Approval status */
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'review';

  /** Who created/uploaded this asset */
  createdBy?: string;

  /** Last modified by */
  modifiedBy?: string;

  /** Expiration date for the asset */
  expiresAt?: string;

  /** Custom organization-specific metadata fields */
  customFields?: Record<string, string | number | boolean>;
}

// =============================================================================
// Request/Response Types
// =============================================================================

export interface MountRequest {
  /** Provider ID */
  providerId: string;

  /** Display name */
  name: string;

  /** Provider-specific configuration */
  config: Record<string, unknown>;
}

export interface WarmRequest {
  sourceId: string;
  filePath: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface WarmProgress {
  filePath: string;
  status: 'warming' | 'completed' | 'error';
  progress: number;
  bytesTransferred?: number;
  totalBytes?: number;
}

export interface TranscodeRequest {
  sourceId: string;
  filePath: string;
  format: 'hls' | 'dash' | 'mp4';
  quality?: 'low' | 'medium' | 'high';
}

export interface TranscodeProgress {
  filePath: string;
  status: 'pending' | 'transcoding' | 'completed' | 'error';
  progress: number;
  outputPath?: string;
  outputUrl?: string;
}

// =============================================================================
// Provider Registry (for dynamic registration)
// =============================================================================

/**
 * Storage provider registry - manages available providers
 */
class StorageProviderRegistry {
  private providers: Map<string, StorageProviderDefinition> = new Map();

  constructor() {
    // Register built-in providers
    BUILTIN_PROVIDERS.forEach((p) => this.register(p));
  }

  /** Register a new provider */
  register(provider: StorageProviderDefinition): void {
    this.providers.set(provider.id, provider);
  }

  /** Unregister a provider */
  unregister(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  /** Get a provider by ID */
  get(providerId: string): StorageProviderDefinition | undefined {
    return this.providers.get(providerId);
  }

  /** Get all providers */
  getAll(): StorageProviderDefinition[] {
    return Array.from(this.providers.values());
  }

  /** Get providers by category */
  getByCategory(category: StorageCategory): StorageProviderDefinition[] {
    return this.getAll().filter((p) => p.category === category);
  }

  /** Check if provider exists */
  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }
}

/** Global provider registry instance */
export const providerRegistry = new StorageProviderRegistry();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get provider display info for a storage source
 */
export function getProviderInfo(
  source: StorageSource,
): StorageProviderDefinition | undefined {
  return providerRegistry.get(source.providerId);
}

/**
 * Get icon for a storage category
 */
export function getCategoryIcon(category: StorageCategory): string {
  const icons: Record<StorageCategory, string> = {
    local: 'hard-drive',
    cloud: 'cloud',
    block: 'database',
    network: 'network',
    hybrid: 'server',
    custom: 'puzzle',
  };
  return icons[category] || 'folder';
}

/**
 * Get display name for a storage category
 */
export function getCategoryName(category: StorageCategory): string {
  const names: Record<StorageCategory, string> = {
    local: 'Local Storage',
    cloud: 'Cloud Storage',
    block: 'Block Storage',
    network: 'Network Shares',
    hybrid: 'Hybrid Storage',
    custom: 'Custom Providers',
  };
  return names[category] || 'Unknown';
}

// Legacy type aliases for backward compatibility
export type StorageSourceType = string;
export type StorageType = string;

// =============================================================================
// Tier Configuration System
// =============================================================================

/**
 * Storage tier types - organization configurable
 */
export type TierType = 'hot' | 'warm' | 'nearline' | 'cold' | 'archive';

/**
 * Tier provider configuration - maps tiers to actual storage backends
 */
export interface TierProviderConfig {
  /** Tier type */
  tier: TierType;

  /** Display name */
  name: string;

  /** Provider ID (e.g., 'fsx-ontap', 'aws-s3-ir', 'fsxn-s3') */
  providerId: string;

  /** Provider-specific configuration */
  config: Record<string, unknown>;

  /** Description */
  description?: string;

  /** Estimated retrieval time in seconds (0 = instant) */
  retrievalTimeSeconds?: number;

  /** Cost tier (for display, 1 = cheapest, 5 = most expensive) */
  costTier?: 1 | 2 | 3 | 4 | 5;

  /** Whether metadata is always accessible (even if data is not) */
  metadataAccessible?: boolean;
}

/**
 * Organization tier configuration
 */
export interface OrgTierConfig {
  /** Organization ID */
  orgId: string;

  /** Tier configurations */
  tiers: TierProviderConfig[];

  /** Default tier for new files */
  defaultTier: TierType;

  /** Auto-tiering rules */
  autoTieringRules?: AutoTieringRule[];

  /** Last updated timestamp */
  updatedAt?: string;
}

/**
 * Auto-tiering rule
 */
export interface AutoTieringRule {
  /** Rule ID */
  id: string;

  /** Rule name */
  name: string;

  /** Source tier */
  fromTier: TierType;

  /** Target tier */
  toTier: TierType;

  /** Days since last access before moving */
  daysInactive: number;

  /** File size threshold in bytes (optional) */
  minSizeBytes?: number;

  /** File patterns to include (glob) */
  includePatterns?: string[];

  /** File patterns to exclude (glob) */
  excludePatterns?: string[];

  /** Is this rule enabled */
  enabled: boolean;
}

/**
 * Default AWS tier configuration
 * Hot: FSx ONTAP (fast SSD/NVMe)
 * Nearline: FSxN S3 (metadata accessible, data in S3)
 * Cold: S3 Instant Retrieval
 */
export const DEFAULT_AWS_TIER_CONFIG: TierProviderConfig[] = [
  {
    tier: 'hot',
    name: 'Hot (FSx ONTAP)',
    providerId: 'fsx-ontap',
    config: {},
    description: 'High-performance SSD storage with sub-millisecond latency',
    retrievalTimeSeconds: 0,
    costTier: 5,
    metadataAccessible: true,
  },
  {
    tier: 'nearline',
    name: 'Nearline (FSxN S3)',
    providerId: 'fsxn-s3',
    config: {},
    description: 'FSx ONTAP with S3 tiering - metadata always accessible',
    retrievalTimeSeconds: 1,
    costTier: 3,
    metadataAccessible: true,
  },
  {
    tier: 'cold',
    name: 'Cold (S3 Instant Retrieval)',
    providerId: 'aws-s3-ir',
    config: {},
    description: 'S3 Glacier Instant Retrieval - low cost, instant access',
    retrievalTimeSeconds: 0,
    costTier: 2,
    metadataAccessible: true,
  },
  {
    tier: 'archive',
    name: 'Archive (S3 Glacier Deep)',
    providerId: 'aws-s3-glacier-deep',
    config: {},
    description: 'Lowest cost archival - 12+ hour retrieval',
    retrievalTimeSeconds: 43200, // 12 hours
    costTier: 1,
    metadataAccessible: true,
  },
];

// =============================================================================
// AWS Tier Storage Providers
// =============================================================================

/** AWS S3 Instant Retrieval provider */
export const AWS_S3_IR_PROVIDER: StorageProviderDefinition = {
  id: 'aws-s3-ir',
  name: 'S3 Glacier Instant Retrieval',
  category: 'cloud',
  icon: 'snowflake',
  description:
    'Low-cost storage with instant retrieval for infrequently accessed data',
  builtIn: true,
  configSchema: [
    { key: 'bucket', label: 'Bucket', type: 'text', required: true },
    { key: 'region', label: 'Region', type: 'text', required: true },
    { key: 'prefix', label: 'Prefix', type: 'text', required: false },
  ],
  features: { tiering: true, versioning: true, encryption: true },
};

/** AWS FSxN S3 provider (FSx ONTAP with S3 fabric pool) */
export const FSXN_S3_PROVIDER: StorageProviderDefinition = {
  id: 'fsxn-s3',
  name: 'FSxN S3 (Fabric Pool)',
  category: 'hybrid',
  icon: 'layers',
  description:
    'FSx ONTAP with automatic S3 tiering - metadata always accessible',
  builtIn: true,
  configSchema: [
    {
      key: 'volumePath',
      label: 'FSx Volume Mount',
      type: 'path',
      required: true,
    },
    {
      key: 's3Bucket',
      label: 'S3 Capacity Pool Bucket',
      type: 'text',
      required: true,
    },
    {
      key: 'tieringPolicy',
      label: 'Tiering Policy',
      type: 'select',
      required: true,
      options: [
        { value: 'auto', label: 'Auto (tier cold data to S3)' },
        { value: 'snapshot-only', label: 'Snapshot Only' },
        { value: 'all', label: 'All (aggressive tiering)' },
        { value: 'none', label: 'None (keep on SSD)' },
      ],
    },
    {
      key: 'coolingDays',
      label: 'Cooling Period (days)',
      type: 'number',
      required: false,
      defaultValue: 31,
    },
  ],
  features: { tiering: true, thumbnails: true, transcoding: true },
};

/** AWS S3 Glacier Deep Archive provider */
export const AWS_S3_GLACIER_DEEP_PROVIDER: StorageProviderDefinition = {
  id: 'aws-s3-glacier-deep',
  name: 'S3 Glacier Deep Archive',
  category: 'cloud',
  icon: 'archive',
  description: 'Lowest cost archival storage with 12-48 hour retrieval',
  builtIn: true,
  configSchema: [
    { key: 'bucket', label: 'Bucket', type: 'text', required: true },
    { key: 'region', label: 'Region', type: 'text', required: true },
    { key: 'prefix', label: 'Prefix', type: 'text', required: false },
    {
      key: 'retrievalTier',
      label: 'Retrieval Speed',
      type: 'select',
      required: false,
      options: [
        { value: 'Standard', label: 'Standard (12 hours)' },
        { value: 'Bulk', label: 'Bulk (48 hours, lowest cost)' },
      ],
    },
  ],
  features: { tiering: true, versioning: true, encryption: true },
};

// Register AWS tier providers
providerRegistry.register(AWS_S3_IR_PROVIDER);
providerRegistry.register(FSXN_S3_PROVIDER);
providerRegistry.register(AWS_S3_GLACIER_DEEP_PROVIDER);

// =============================================================================
// Deployment Modes - Three primary use cases
// =============================================================================

/**
 * Deployment mode determines how storage is accessed
 *
 * 1. CLOUD_GPU: Running on cloud GPU instance (Windows Server 2025)
 *    - FSx ONTAP mounted directly
 *    - NVMe cache for hot data
 *    - Can move files between Hot (FSx) and Nearline (S3)
 *
 * 2. WORKSTATION: Local workstation with LucidLink or local storage
 *    - Local NVMe/SSD for hot data
 *    - LucidLink mount for team storage
 *    - Can cache remote files locally
 *
 * 3. BROWSER_ONLY: API-based access, no local mounts
 *    - Metadata served from Elasticsearch
 *    - Video previews via transcoding API
 *    - Thumbnails served by API
 *    - Download capability for individual files
 */
export type DeploymentMode = 'cloud-gpu' | 'workstation' | 'browser-only';

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
  /** Current deployment mode */
  mode: DeploymentMode;

  /** Whether NVMe cache is available */
  hasNvmeCache: boolean;

  /** NVMe cache configuration (if available) */
  nvmeCacheConfig?: NvmeCacheConfig;

  /** Whether local mounts are available */
  hasLocalMounts: boolean;

  /** API endpoint for browser-only mode */
  apiEndpoint?: string;

  /** Metadata source configuration */
  metadataSource?: MetadataSourceConfig;

  /** LucidLink configuration (for workstation mode) */
  lucidLinkConfig?: LucidLinkConfig;
}

/**
 * NVMe cache configuration for Windows Server 2025
 */
export interface NvmeCacheConfig {
  /** Path to NVMe cache directory */
  cachePath: string;

  /** Maximum cache size in bytes */
  maxSizeBytes: number;

  /** Cache eviction policy */
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'size-priority';

  /** Minimum free space to maintain (bytes) */
  minFreeSpaceBytes: number;

  /** Whether to enable read-ahead caching */
  enableReadAhead: boolean;

  /** Read-ahead size in bytes */
  readAheadBytes?: number;

  /** Whether to enable write-behind caching */
  enableWriteBehind: boolean;

  /** Write-behind flush interval in seconds */
  writeBehindFlushSeconds?: number;

  /** Priority boost for recently accessed files */
  accessRecencyWeight: number;

  /** Priority boost for frequently accessed files */
  accessFrequencyWeight: number;
}

/**
 * Default NVMe cache configuration for Windows Server 2025
 */
export const DEFAULT_NVME_CACHE_CONFIG: NvmeCacheConfig = {
  cachePath: 'D:\\UrslyCache', // Typical NVMe drive on Windows
  maxSizeBytes: 500 * 1024 * 1024 * 1024, // 500 GB
  evictionPolicy: 'lru',
  minFreeSpaceBytes: 50 * 1024 * 1024 * 1024, // 50 GB min free
  enableReadAhead: true,
  readAheadBytes: 256 * 1024 * 1024, // 256 MB read-ahead
  enableWriteBehind: true,
  writeBehindFlushSeconds: 30,
  accessRecencyWeight: 0.7,
  accessFrequencyWeight: 0.3,
};

/**
 * Metadata source configuration for browser-only mode
 */
export interface MetadataSourceConfig {
  /** Metadata backend type */
  type: 'elasticsearch' | 'mongodb' | 'postgresql';

  /** Connection endpoint */
  endpoint: string;

  /** Index/collection/table name */
  indexName: string;

  /** Authentication */
  auth?: {
    type: 'basic' | 'api-key' | 'bearer';
    credentials: string;
  };

  /** Enable real-time sync */
  enableSync: boolean;

  /** Sync interval in seconds (if not real-time) */
  syncIntervalSeconds?: number;
}

/**
 * LucidLink configuration for workstation mode
 */
export interface LucidLinkConfig {
  /** LucidLink mount path */
  mountPath: string;

  /** Filespace name */
  filespace: string;

  /** Local cache path for LucidLink */
  localCachePath?: string;

  /** Pin mode for keeping files local */
  pinMode?: 'none' | 'manual' | 'smart' | 'all';

  /** Maximum local cache size */
  maxLocalCacheBytes?: number;
}

// =============================================================================
// File Accessibility States
// =============================================================================

/**
 * File data accessibility - how the file content can be accessed
 */
export type DataAccessibility =
  | 'local' // Data is on local disk, instant access
  | 'mounted' // Data is on mounted filesystem (FSx, NFS, SMB)
  | 'cached' // Data is cached locally (NVMe cache)
  | 'nearline' // Metadata local, data in S3 (FSxN tiering)
  | 'remote' // Data requires download/retrieval
  | 'archive'; // Data in deep archive, significant retrieval time

/**
 * Extended file metadata for multi-mode access
 */
export interface FileAccessInfo {
  /** How data is currently accessible */
  dataAccessibility: DataAccessibility;

  /** Whether metadata is fully available */
  metadataComplete: boolean;

  /** Estimated retrieval time in seconds (0 = instant) */
  estimatedRetrievalSeconds: number;

  /** Whether a preview/proxy is available */
  hasPreview: boolean;

  /** Preview URL (for browser-only mode) */
  previewUrl?: string;

  /** Thumbnail URL (for browser-only mode) */
  thumbnailUrl?: string;

  /** Whether file can be downloaded */
  canDownload: boolean;

  /** Download URL (presigned or API endpoint) */
  downloadUrl?: string;

  /** Whether file can be streamed (video) */
  canStream: boolean;

  /** HLS/DASH streaming URL */
  streamUrl?: string;

  /** Whether file is pinned to local cache */
  isPinned: boolean;

  /** Cache status */
  cacheStatus?: 'not-cached' | 'caching' | 'cached' | 'evicting';

  /** Bytes cached locally */
  bytesCached?: number;
}

// =============================================================================
// API Response Types for Browser-Only Mode
// =============================================================================

/**
 * File listing response from API
 */
export interface ApiFileListResponse {
  files: FileMetadata[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  /** Aggregations for filtering */
  aggregations?: {
    tags?: { name: string; count: number }[];
    mimeTypes?: { type: string; count: number }[];
    tiers?: { tier: FileTierStatus; count: number }[];
    projects?: { name: string; count: number }[];
    dateRanges?: { range: string; count: number }[];
  };
}

/**
 * Search request for Elasticsearch-backed metadata
 */
export interface ApiSearchRequest {
  /** Text query (full-text search) */
  query?: string;

  /** Filters */
  filters?: {
    sourceIds?: string[];
    tags?: string[];
    mimeTypes?: string[];
    tiers?: FileTierStatus[];
    projects?: string[];
    dateRange?: { from?: string; to?: string };
    sizeRange?: { min?: number; max?: number };
  };

  /** Pagination */
  page?: number;
  pageSize?: number;

  /** Sort */
  sort?: {
    field: 'name' | 'size' | 'lastModified' | 'createdAt' | 'relevance';
    order: 'asc' | 'desc';
  };

  /** Include aggregations in response */
  includeAggregations?: boolean;
}

/**
 * Thumbnail/preview request
 */
export interface ApiPreviewRequest {
  sourceId: string;
  filePath: string;
  type: 'thumbnail' | 'preview' | 'stream';
  /** For thumbnails: size in pixels */
  size?: number;
  /** For video: quality preset */
  quality?: 'low' | 'medium' | 'high';
}

/**
 * Transcode/stream response
 */
export interface ApiStreamResponse {
  /** HLS manifest URL */
  manifestUrl: string;
  /** Available quality levels */
  qualities: {
    label: string;
    width: number;
    height: number;
    bitrate: number;
  }[];
  /** Duration in seconds */
  duration: number;
  /** Poster image URL */
  posterUrl?: string;
  /** Expires at (for presigned URLs) */
  expiresAt?: string;
}

// =============================================================================
// Global Favorites
// =============================================================================

/**
 * Global favorite entry - not tied to a specific source
 */
export interface GlobalFavorite {
  /** Unique ID */
  id: string;

  /** Display name */
  name: string;

  /** Full path (including source) */
  path: string;

  /** Source ID */
  sourceId: string;

  /** Source name (for display when source is disconnected) */
  sourceName: string;

  /** Icon (derived from file type) */
  icon?: string;

  /** Is this a directory */
  isDirectory: boolean;

  /** Added timestamp */
  addedAt: string;

  /** Sort order */
  order?: number;
}

// =========================================================================
// OS Preferences
// =========================================================================

/**
 * OS file system preferences - retrieved from system settings
 */
export interface OsPreferences {
  /** Whether to show hidden files by default */
  showHiddenFiles: boolean;
  /** Whether to show file extensions */
  showFileExtensions: boolean;
  /** Whether to show path bar */
  showPathBar: boolean;
  /** Whether to show status bar */
  showStatusBar: boolean;
  /** Default view mode */
  defaultView: 'icon' | 'list' | 'column' | 'gallery';
  /** Sort files by */
  sortBy: 'name' | 'date' | 'size' | 'type';
  /** Sort direction */
  sortAscending: boolean;
  /** Platform name */
  platform: 'macos' | 'windows' | 'linux';
}
