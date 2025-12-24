/**
 * BrowserApiService - API-based VFS operations for browser-only mode
 *
 * This service provides file system operations when running in a browser
 * without access to Tauri/native filesystem. It communicates with the
 * backend API to access metadata stored in Elasticsearch and provides
 * limited operations like view, search, tag, and download.
 */

import type {
  StorageSource,
  FileMetadata,
  ApiSearchRequest,
  ApiFileListResponse,
  ApiPreviewRequest,
  ApiStreamResponse,
  DeploymentConfig,
  FileTierStatus,
} from '../types/storage';

// Default API endpoint - can be overridden via config
const DEFAULT_API_ENDPOINT = '/api/vfs';

/**
 * Configuration for the browser API service
 */
export interface BrowserApiConfig {
  /** API endpoint base URL */
  apiEndpoint: string;

  /** Authentication token */
  authToken?: string;

  /** Organization ID for multi-tenant */
  orgId?: string;
}

/**
 * Browser API Service for VFS operations
 */
export class BrowserApiService {
  private config: BrowserApiConfig;

  constructor(config?: Partial<BrowserApiConfig>) {
    this.config = {
      apiEndpoint: config?.apiEndpoint || DEFAULT_API_ENDPOINT,
      authToken: config?.authToken,
      orgId: config?.orgId,
    };
  }

  /**
   * Get request headers with authentication
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    if (this.config.orgId) {
      headers['X-Org-Id'] = this.config.orgId;
    }

    return headers;
  }

  /**
   * Make API request with error handling
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.config.apiEndpoint}${path}`;

    const response = await fetch(url, {
      method,
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `API error: ${response.status}`);
    }

    return response.json();
  }

  // ===========================================================================
  // Storage Source Operations
  // ===========================================================================

  /**
   * List all available storage sources (metadata-only in browser mode)
   */
  async listSources(): Promise<StorageSource[]> {
    return this.request<StorageSource[]>('GET', '/sources');
  }

  /**
   * Get source details by ID
   */
  async getSource(sourceId: string): Promise<StorageSource | null> {
    try {
      return this.request<StorageSource>('GET', `/sources/${sourceId}`);
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // File Listing Operations
  // ===========================================================================

  /**
   * List files in a path (from metadata store)
   */
  async listFiles(
    sourceId: string,
    path: string,
    options?: { showHidden?: boolean; page?: number; pageSize?: number },
  ): Promise<ApiFileListResponse> {
    const params = new URLSearchParams({
      path,
      showHidden: String(options?.showHidden ?? false),
      page: String(options?.page ?? 1),
      pageSize: String(options?.pageSize ?? 100),
    });

    return this.request<ApiFileListResponse>(
      'GET',
      `/sources/${sourceId}/files?${params}`,
    );
  }

  /**
   * Get file metadata by path
   */
  async getFileMetadata(
    sourceId: string,
    path: string,
  ): Promise<FileMetadata | null> {
    try {
      return this.request<FileMetadata>(
        'GET',
        `/sources/${sourceId}/file?path=${encodeURIComponent(path)}`,
      );
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Search Operations
  // ===========================================================================

  /**
   * Search files across all sources (Elasticsearch-backed)
   */
  async search(request: ApiSearchRequest): Promise<ApiFileListResponse> {
    return this.request<ApiFileListResponse>('POST', '/search', request);
  }

  /**
   * Get search suggestions/autocomplete
   */
  async searchSuggest(query: string, limit = 10): Promise<string[]> {
    return this.request<string[]>(
      'GET',
      `/search/suggest?q=${encodeURIComponent(query)}&limit=${limit}`,
    );
  }

  // ===========================================================================
  // Preview Operations
  // ===========================================================================

  /**
   * Get thumbnail URL for a file
   */
  getThumbnailUrl(sourceId: string, path: string, size = 256): string {
    const params = new URLSearchParams({
      path,
      size: String(size),
    });
    return `${this.config.apiEndpoint}/sources/${sourceId}/thumbnail?${params}`;
  }

  /**
   * Get preview URL for a file (larger image, PDF preview, etc.)
   */
  getPreviewUrl(sourceId: string, path: string): string {
    const params = new URLSearchParams({ path });
    return `${this.config.apiEndpoint}/sources/${sourceId}/preview?${params}`;
  }

  /**
   * Get video stream info
   */
  async getStreamInfo(
    sourceId: string,
    path: string,
  ): Promise<ApiStreamResponse> {
    return this.request<ApiStreamResponse>(
      'POST',
      `/sources/${sourceId}/stream`,
      { path },
    );
  }

  // ===========================================================================
  // Download Operations
  // ===========================================================================

  /**
   * Get download URL (presigned) for a file
   */
  async getDownloadUrl(sourceId: string, path: string): Promise<string> {
    const result = await this.request<{ url: string }>(
      'POST',
      `/sources/${sourceId}/download`,
      { path },
    );
    return result.url;
  }

  /**
   * Request file retrieval from cold/archive tier
   */
  async requestRetrieval(
    sourceId: string,
    paths: string[],
    tier: 'standard' | 'bulk' | 'expedited' = 'standard',
  ): Promise<{ requestId: string; estimatedMinutes: number }> {
    return this.request<{ requestId: string; estimatedMinutes: number }>(
      'POST',
      `/sources/${sourceId}/retrieve`,
      { paths, tier },
    );
  }

  // ===========================================================================
  // Tagging Operations
  // ===========================================================================

  /**
   * Add tags to files
   */
  async addTags(
    sourceId: string,
    paths: string[],
    tags: string[],
  ): Promise<void> {
    await this.request('POST', '/tags', {
      sourceId,
      paths,
      tags,
      action: 'add',
    });
  }

  /**
   * Remove tags from files
   */
  async removeTags(
    sourceId: string,
    paths: string[],
    tags: string[],
  ): Promise<void> {
    await this.request('POST', '/tags', {
      sourceId,
      paths,
      tags,
      action: 'remove',
    });
  }

  /**
   * List all available tags
   */
  async listAllTags(): Promise<
    { name: string; count: number; color?: string }[]
  > {
    return this.request<{ name: string; count: number; color?: string }[]>(
      'GET',
      '/tags',
    );
  }

  // ===========================================================================
  // Favorites Operations (stored in user preferences)
  // ===========================================================================

  /**
   * Get user favorites
   */
  async getFavorites(): Promise<
    { sourceId: string; path: string; name: string }[]
  > {
    return this.request<{ sourceId: string; path: string; name: string }[]>(
      'GET',
      '/favorites',
    );
  }

  /**
   * Add a favorite
   */
  async addFavorite(
    sourceId: string,
    path: string,
    name: string,
  ): Promise<void> {
    await this.request('POST', '/favorites', { sourceId, path, name });
  }

  /**
   * Remove a favorite
   */
  async removeFavorite(sourceId: string, path: string): Promise<void> {
    await this.request(
      'DELETE',
      `/favorites?sourceId=${sourceId}&path=${encodeURIComponent(path)}`,
    );
  }

  // ===========================================================================
  // Tier Information
  // ===========================================================================

  /**
   * Get tier status for files
   */
  async getTierStatus(
    sourceId: string,
    paths: string[],
  ): Promise<Record<string, FileTierStatus>> {
    return this.request<Record<string, FileTierStatus>>(
      'POST',
      `/sources/${sourceId}/tier-status`,
      { paths },
    );
  }

  /**
   * Request tier change (hot/warm/cold)
   * Note: In browser mode this creates a request that backend processes
   */
  async requestTierChange(
    sourceId: string,
    paths: string[],
    targetTier: FileTierStatus,
  ): Promise<{ requestId: string }> {
    return this.request<{ requestId: string }>(
      'POST',
      `/sources/${sourceId}/tier-change`,
      { paths, targetTier },
    );
  }

  // ===========================================================================
  // Deployment Mode Detection
  // ===========================================================================

  /**
   * Get current deployment configuration
   */
  async getDeploymentConfig(): Promise<DeploymentConfig> {
    // In browser mode, we're always in browser-only mode
    return {
      mode: 'browser-only',
      hasNvmeCache: false,
      hasLocalMounts: false,
      apiEndpoint: this.config.apiEndpoint,
    };
  }

  /**
   * Check if Tauri is available (returns false in browser mode)
   */
  static isTauriAvailable(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  }
}

// Singleton instance
let browserApiInstance: BrowserApiService | null = null;

/**
 * Get the browser API service instance
 */
export function getBrowserApi(
  config?: Partial<BrowserApiConfig>,
): BrowserApiService {
  if (!browserApiInstance || config) {
    browserApiInstance = new BrowserApiService(config);
  }
  return browserApiInstance;
}

/**
 * Initialize browser API with configuration
 */
export function initBrowserApi(
  config: Partial<BrowserApiConfig>,
): BrowserApiService {
  browserApiInstance = new BrowserApiService(config);
  return browserApiInstance;
}

export default BrowserApiService;
