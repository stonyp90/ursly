/**
 * Storage Service - Frontend service for VFS operations
 * Communicates with Tauri backend via invoke commands
 *
 * All operations use real VFS backend - no mocks
 * Supports dynamic storage providers (any CSP or on-prem solution)
 */
import { invoke } from '@tauri-apps/api/core';
import type {
  StorageSource,
  FileMetadata,
  MountRequest,
  WarmRequest,
  TranscodeRequest,
  StorageProviderDefinition,
  StorageCategory,
} from '../types/storage';
import { providerRegistry } from '../types/storage';

export class StorageService {
  private static initialized = false;

  /**
   * Initialize VFS (call once at app start)
   */
  static async init(): Promise<void> {
    if (this.initialized) return;
    await invoke('vfs_init');
    this.initialized = true;
  }

  /**
   * List all configured storage sources
   */
  static async listSources(): Promise<StorageSource[]> {
    await this.init();
    const sources = await invoke<VfsStorageSource[]>('vfs_list_sources');

    // Map VFS sources to StorageSource format with dynamic provider support
    return sources.map((s) => {
      const providerId = mapSourceTypeToProviderId(s.source_type);
      const category = mapSourceTypeToCategory(s.source_type);
      const status = (
        s.status === 'connected' || s.mounted ? 'connected' : 'disconnected'
      ) as 'connected' | 'connecting' | 'disconnected' | 'error';

      return {
        id: s.id,
        name: s.name,
        providerId,
        category,
        config: {
          path: s.path,
          bucket: s.bucket,
          region: s.region,
        },
        status,
        // Volume vs Location flags
        isEjectable: s.is_ejectable ?? false,
        isSystemLocation: s.is_system_location ?? false,
        // Backward compatibility
        type: providerId,
        connected: status === 'connected',
        path: s.path,
        bucket: s.bucket,
        region: s.region,
      };
    });
  }

  /**
   * Get all available storage providers
   */
  static getAvailableProviders(): StorageProviderDefinition[] {
    return providerRegistry.getAll();
  }

  /**
   * Get providers by category
   */
  static getProvidersByCategory(
    category: StorageCategory,
  ): StorageProviderDefinition[] {
    return providerRegistry.getByCategory(category);
  }

  /**
   * Register a custom storage provider
   */
  static registerProvider(provider: StorageProviderDefinition): void {
    providerRegistry.register(provider);
  }

  /**
   * Mount a new storage source
   */
  static async mountSource(request: MountRequest): Promise<StorageSource> {
    await this.init();

    const providerId = request.providerId;
    const config = request.config;

    // Handle different provider types
    if (providerId === 'local' && config.path) {
      const source = await invoke<VfsStorageSource>('vfs_mount_local', {
        name: request.name,
        path: config.path,
      });
      return {
        id: source.id,
        name: source.name,
        providerId: 'local',
        category: 'local',
        config: { path: source.path },
        status: 'connected' as const,
        // Backward compat
        type: 'local',
        connected: true,
        path: source.path,
      };
    }

    // For other providers, use the generic mount command
    // This will be extended to support S3, GCS, Azure, etc.
    const source = await invoke<VfsStorageSource>('vfs_mount_source', {
      providerId,
      name: request.name,
      config,
    });

    const category = mapSourceTypeToCategory(source.source_type);
    return {
      id: source.id,
      name: source.name,
      providerId,
      category,
      config,
      status: 'connected' as const,
      // Backward compat
      type: providerId,
      connected: true,
      path: config.path as string | undefined,
      bucket: config.bucket as string | undefined,
      region: config.region as string | undefined,
    };
  }

  /**
   * List files in a storage source
   */
  static async listFiles(sourceId: string, path = ''): Promise<FileMetadata[]> {
    await this.init();

    // Normalize path
    const normalizedPath = path || '/';

    const files = await invoke<VfsFileMetadata[]>('vfs_list_files', {
      sourceId,
      path: normalizedPath,
    });

    // Map VFS files to FileMetadata format
    return files.map((f) => ({
      id: f.id,
      name: f.name,
      path: f.path,
      size: f.size,
      size_human: f.size_human,
      lastModified: f.last_modified,
      mimeType: f.is_directory ? 'folder' : getMimeType(f.name),
      isDirectory: f.is_directory,
      isHidden: f.is_hidden ?? f.name.startsWith('.'),
      tierStatus: f.tier_status as 'hot' | 'cold' | 'warm' | 'archive',
      canWarm: f.can_warm,
      isCached: f.is_cached,
      isWarmed: f.is_cached,
      canTranscode: f.can_transcode,
      thumbnail: undefined,
    }));
  }

  /**
   * Warm a file (move from cold to hot tier)
   */
  static async warmFile(request: WarmRequest): Promise<void> {
    await this.init();
    await invoke('vfs_warm_file', {
      sourceId: request.sourceId,
      filePath: request.filePath,
    });
  }

  /**
   * Start video transcoding
   */
  static async transcodeVideo(request: TranscodeRequest): Promise<void> {
    await this.init();
    await invoke('vfs_transcode_video', {
      sourceId: request.sourceId,
      filePath: request.filePath,
      format: request.format,
    });
  }

  /**
   * Unmount a storage source
   */
  static async unmountSource(sourceId: string): Promise<void> {
    await invoke('vfs_unmount', { sourceId });
  }

  /**
   * Get detailed file info
   */
  static async getFileInfo(
    sourceId: string,
    path: string,
  ): Promise<FileMetadata> {
    await this.init();
    const f = await invoke<VfsFileMetadata>('vfs_file_info', {
      sourceId,
      path,
    });
    return {
      id: f.id,
      name: f.name,
      path: f.path,
      size: f.size,
      size_human: f.size_human,
      lastModified: f.last_modified,
      mimeType: f.is_directory ? 'folder' : getMimeType(f.name),
      isDirectory: f.is_directory,
      tierStatus: f.tier_status as 'hot' | 'cold' | 'warm' | 'archive',
      canWarm: f.can_warm,
      isCached: f.is_cached,
      isWarmed: f.is_cached,
      canTranscode: f.can_transcode,
    };
  }

  // =========================================================================
  // Clipboard Operations
  // =========================================================================

  /**
   * Copy files to clipboard
   */
  static async copyFiles(sourceId: string, paths: string[]): Promise<void> {
    await this.init();
    await invoke('vfs_clipboard_copy', { sourceId, paths });
  }

  /**
   * Cut files to clipboard
   */
  static async cutFiles(sourceId: string, paths: string[]): Promise<void> {
    await this.init();
    await invoke('vfs_clipboard_cut', { sourceId, paths });
  }

  /**
   * Paste files to destination
   */
  static async pasteFiles(
    destSourceId: string,
    destPath: string,
  ): Promise<{
    files_pasted: number;
    files_failed: number;
    pasted_paths: string[];
    errors: string[];
  }> {
    await this.init();
    return invoke('vfs_clipboard_paste_to_vfs', { destSourceId, destPath });
  }

  /**
   * Check if clipboard has files
   */
  static async hasClipboardFiles(): Promise<boolean> {
    try {
      const result = await invoke<boolean>('vfs_clipboard_has_files');
      return result;
    } catch (err) {
      console.error('hasClipboardFiles error:', err);
      return false;
    }
  }

  /**
   * Get current clipboard content
   */
  static async getClipboardContent(): Promise<{
    operation: 'copy' | 'cut';
    source: string;
    paths: string[];
    file_count: number;
  } | null> {
    try {
      const result = await invoke<{
        operation: string;
        source: string;
        paths: string[];
        file_count: number;
      } | null>('vfs_clipboard_get');
      return result
        ? {
            ...result,
            operation: result.operation as 'copy' | 'cut',
          }
        : null;
    } catch (err) {
      console.error('getClipboardContent error:', err);
      return null;
    }
  }

  /**
   * Read files from native OS clipboard (Finder/Explorer copy)
   */
  static async readNativeClipboard(): Promise<string[]> {
    try {
      return await invoke<string[]>('vfs_clipboard_read_native');
    } catch (err) {
      console.error('readNativeClipboard error:', err);
      return [];
    }
  }

  /**
   * Write files to native OS clipboard (for Finder/Explorer paste)
   */
  static async writeNativeClipboard(paths: string[]): Promise<void> {
    await invoke('vfs_clipboard_write_native', { paths });
  }

  /**
   * Paste clipboard content to native filesystem
   */
  static async pasteToNative(destPath: string): Promise<{
    files_pasted: number;
    files_failed: number;
    pasted_paths: string[];
    errors: string[];
  }> {
    return invoke('vfs_clipboard_paste_to_native', { destPath });
  }

  /**
   * Clear the clipboard
   */
  static async clearClipboard(): Promise<void> {
    await invoke('vfs_clipboard_clear');
  }

  /**
   * Copy native files (already on disk) to VFS internal clipboard
   * This is for when user pastes files from Finder into VFS
   */
  static async copyNativeToClipboard(paths: string[]): Promise<void> {
    await invoke('vfs_clipboard_copy_native', { paths });
  }
}

// Helper to get MIME type from filename
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
    txt: 'text/plain',
    json: 'application/json',
    xml: 'application/xml',
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// ============================================================================
// VFS Service - Uses real local filesystem access (vfs_ prefixed commands)
// ============================================================================

export interface VfsStorageSource {
  id: string;
  name: string;
  source_type: string;
  mounted: boolean;
  status: string;
  path?: string;
  bucket?: string;
  region?: string;
  is_ejectable?: boolean;
  is_system_location?: boolean;
}

export interface VfsFileMetadata {
  id: string;
  name: string;
  path: string;
  size: number;
  size_human: string;
  last_modified: string;
  is_directory: boolean;
  is_hidden?: boolean;
  tier_status: string;
  is_cached: boolean;
  can_warm: boolean;
  can_transcode: boolean;
  transcode_status?: string;
  transcode_progress?: number;
}

export interface VfsOsPreferences {
  show_hidden_files: boolean;
  show_file_extensions: boolean;
  show_path_bar: boolean;
  show_status_bar: boolean;
  default_view: string;
  sort_by: string;
  sort_ascending: boolean;
  platform: string;
}

export interface VfsCacheStats {
  total_size: number;
  max_size: number;
  entry_count: number;
  hit_count: number;
  miss_count: number;
  hit_rate: number;
  usage_percent: number;
}

/**
 * VfsService - Real local filesystem access using Clean Architecture VFS
 *
 * Usage:
 *   await VfsService.init();
 *   const source = await VfsService.mountLocal('My Documents', '/Users/me/Documents');
 *   const files = await VfsService.listFiles(source.id, '/');
 */
export class VfsService {
  /**
   * Initialize the VFS service (required before other operations)
   */
  static async init(): Promise<string> {
    return invoke('vfs_init');
  }

  /**
   * List all mounted VFS sources
   */
  static async listSources(): Promise<VfsStorageSource[]> {
    return invoke('vfs_list_sources');
  }

  /**
   * Mount a local directory
   * @param name Display name for the source
   * @param path Absolute path to the local directory
   */
  static async mountLocal(
    name: string,
    path: string,
  ): Promise<VfsStorageSource> {
    return invoke('vfs_mount_local', { name, path });
  }

  /**
   * List files in a mounted source
   * @param sourceId ID of the mounted source
   * @param path Path within the source (use "/" for root)
   */
  static async listFiles(
    sourceId: string,
    path = '/',
  ): Promise<VfsFileMetadata[]> {
    return invoke('vfs_list_files', { sourceId, path });
  }

  /**
   * Hydrate (warm) a file from cold storage to local cache
   * @param sourceId ID of the storage source
   * @param filePath Path to the file
   * @returns Path to the cached file
   */
  static async warmFile(sourceId: string, filePath: string): Promise<string> {
    return invoke('vfs_warm_file', { sourceId, filePath });
  }

  /**
   * Start video transcoding
   * @param sourceId ID of the storage source
   * @param filePath Path to the video file
   * @param format Target format (hls, dash, mp4)
   */
  static async transcodeVideo(
    sourceId: string,
    filePath: string,
    format: string,
  ): Promise<string> {
    return invoke('vfs_transcode_video', { sourceId, filePath, format });
  }

  /**
   * Get cache statistics
   */
  static async cacheStats(): Promise<VfsCacheStats> {
    return invoke('vfs_cache_stats');
  }

  /**
   * Clear the entire cache
   */
  static async clearCache(): Promise<string> {
    return invoke('vfs_clear_cache');
  }

  /**
   * Get OS file system preferences
   * Reads settings from the operating system (e.g., show hidden files, extensions)
   */
  static async getOsPreferences(): Promise<VfsOsPreferences> {
    return invoke('vfs_get_os_preferences');
  }
}

// =============================================================================
// Helper Functions for Provider Mapping
// =============================================================================

/**
 * Map backend source_type string to provider ID
 */
function mapSourceTypeToProviderId(sourceType: string): string {
  const mapping: Record<string, string> = {
    Local: 'local',
    S3: 'aws-s3',
    Gcs: 'gcs',
    AzureBlob: 'azure-blob',
    S3Compatible: 's3-compatible',
    FsxN: 'fsx-ontap',
    FsxOntap: 'fsx-ontap',
    Nfs: 'nfs',
    Smb: 'smb',
    Nas: 'smb',
    Sftp: 'sftp',
    WebDav: 'webdav',
    Block: 'block',
  };
  return mapping[sourceType] || sourceType.toLowerCase();
}

/**
 * Map backend source_type string to category
 */
function mapSourceTypeToCategory(
  sourceType: string,
): import('../types/storage').StorageCategory {
  const mapping: Record<string, import('../types/storage').StorageCategory> = {
    Local: 'local',
    S3: 'cloud',
    Gcs: 'cloud',
    AzureBlob: 'cloud',
    S3Compatible: 'cloud',
    FsxN: 'hybrid',
    FsxOntap: 'hybrid',
    Nfs: 'network',
    Smb: 'network',
    Nas: 'network',
    Sftp: 'network',
    WebDav: 'network',
    Block: 'block',
  };
  return mapping[sourceType] || 'custom';
}
