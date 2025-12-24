/**
 * Storage Service - Web API client for VFS operations
 * Mirrors the desktop Tauri VFS service but uses REST API
 */
import { apiClient } from './api';

export interface StorageSource {
  id: string;
  name: string;
  providerId: string;
  category: 'local' | 'cloud' | 'network' | 'hybrid' | 'block';
  config?: Record<string, unknown>;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  usedSpace?: number;
  totalSpace?: number;
}

export interface FileMetadata {
  id: string;
  name: string;
  path: string;
  size: number;
  sizeHuman: string;
  mimeType: string;
  lastModified: string;
  created?: string;
  isDirectory: boolean;
  tierStatus?: 'hot' | 'warm' | 'cold' | 'nearline' | 'archive';
  isFavorite?: boolean;
  isWarmed?: boolean;
  canWarm?: boolean;
  canTranscode?: boolean;
  thumbnail?: string;
  tags?: string[];
  colorLabel?: string;
}

export interface ClipboardContent {
  operation: 'copy' | 'cut';
  sourceId: string;
  paths: string[];
}

export type TierType = 'hot' | 'warm' | 'cold' | 'nearline' | 'archive';

export interface TierConfig {
  id: TierType;
  name: string;
  description: string;
  provider: string;
  retrievalTime: string;
  costPerGB: number;
  accessFrequency: string;
}

export interface HydrationRequest {
  sourceId: string;
  paths: string[];
  targetTier: TierType;
  priority?: 'standard' | 'expedited' | 'bulk';
}

export interface HydrationJob {
  id: string;
  sourceId: string;
  paths: string[];
  targetTier: TierType;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  filesCompleted: number;
  filesTotal: number;
  bytesTransferred: number;
  bytesTotal: number;
  estimatedCost: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface TierCostEstimate {
  totalBytes: number;
  retrievalCost: number;
  storageCostDelta: number;
  estimatedTime: string;
}

export interface PasteResult {
  files_pasted: number;
  files_failed: number;
  pasted_paths: string[];
  errors: string[];
}

class StorageServiceClass {
  private clipboard: ClipboardContent | null = null;

  /**
   * List all configured storage sources
   */
  async listSources(): Promise<StorageSource[]> {
    try {
      const response = await apiClient.get<StorageSource[]>('/vfs/sources');
      return response.data;
    } catch (error) {
      console.error('Failed to list sources:', error);
      // Return demo sources for now
      return this.getDemoSources();
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(sourceId: string, path: string): Promise<FileMetadata[]> {
    try {
      const response = await apiClient.get<FileMetadata[]>(
        `/vfs/sources/${sourceId}/files?path=${encodeURIComponent(path)}`,
      );
      return response.data;
    } catch (error) {
      console.error('Failed to list files:', error);
      // Return demo files for now
      return this.getDemoFiles(path);
    }
  }

  /**
   * Add a new storage source
   */
  async addSource(source: Partial<StorageSource>): Promise<StorageSource> {
    const response = await apiClient.post<StorageSource>(
      '/vfs/sources',
      source,
    );
    return response.data;
  }

  /**
   * Remove a storage source
   */
  async removeSource(sourceId: string): Promise<void> {
    await apiClient.delete(`/vfs/sources/${sourceId}`);
  }

  /**
   * Create a new folder
   */
  async createFolder(sourceId: string, path: string): Promise<void> {
    await apiClient.post(`/vfs/sources/${sourceId}/mkdir`, { path });
  }

  /**
   * Delete a file or folder
   */
  async deleteFile(sourceId: string, path: string): Promise<void> {
    await apiClient.delete(`/vfs/sources/${sourceId}/files`, {
      data: { path },
    });
  }

  /**
   * Rename a file or folder
   */
  async renameFile(
    sourceId: string,
    oldPath: string,
    newPath: string,
  ): Promise<void> {
    await apiClient.post(`/vfs/sources/${sourceId}/rename`, {
      oldPath,
      newPath,
    });
  }

  /**
   * Copy files to clipboard
   */
  async copyFiles(sourceId: string, paths: string[]): Promise<void> {
    this.clipboard = {
      operation: 'copy',
      sourceId,
      paths,
    };
  }

  /**
   * Cut files to clipboard
   */
  async cutFiles(sourceId: string, paths: string[]): Promise<void> {
    this.clipboard = {
      operation: 'cut',
      sourceId,
      paths,
    };
  }

  /**
   * Paste files from clipboard
   */
  async pasteFiles(
    destSourceId: string,
    destPath: string,
  ): Promise<PasteResult> {
    if (!this.clipboard) {
      throw new Error('Clipboard is empty');
    }

    try {
      const response = await apiClient.post<PasteResult>(
        `/vfs/sources/${destSourceId}/paste`,
        {
          operation: this.clipboard.operation,
          sourceId: this.clipboard.sourceId,
          paths: this.clipboard.paths,
          destPath,
        },
      );

      // Clear clipboard if cut operation
      if (this.clipboard.operation === 'cut') {
        this.clipboard = null;
      }

      return response.data;
    } catch (error) {
      console.error('Paste failed:', error);
      throw error;
    }
  }

  /**
   * Check if clipboard has files
   */
  hasClipboardFiles(): boolean {
    return this.clipboard !== null && this.clipboard.paths.length > 0;
  }

  /**
   * Clear clipboard
   */
  clearClipboard(): void {
    this.clipboard = null;
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(sourceId: string, path: string): Promise<boolean> {
    const response = await apiClient.post<{ isFavorite: boolean }>(
      `/vfs/sources/${sourceId}/favorite`,
      { path },
    );
    return response.data.isFavorite;
  }

  /**
   * Warm a file (move to hot tier)
   */
  async warmFile(sourceId: string, path: string): Promise<void> {
    await apiClient.post(`/vfs/sources/${sourceId}/warm`, { path });
  }

  /**
   * Get file info
   */
  async getFileInfo(sourceId: string, path: string): Promise<FileMetadata> {
    const response = await apiClient.get<FileMetadata>(
      `/vfs/sources/${sourceId}/info?path=${encodeURIComponent(path)}`,
    );
    return response.data;
  }

  // ============================
  // TIER MIGRATION / HYDRATION
  // ============================

  /**
   * Get available tier configurations for the organization
   */
  async getTierConfigs(): Promise<TierConfig[]> {
    try {
      const response = await apiClient.get<TierConfig[]>('/vfs/tiers');
      return response.data;
    } catch {
      // Return default AWS-based tier configuration
      return this.getDefaultTierConfigs();
    }
  }

  /**
   * Estimate cost and time for tier migration
   */
  async estimateTierMigration(
    sourceId: string,
    paths: string[],
    targetTier: TierType,
  ): Promise<TierCostEstimate> {
    try {
      const response = await apiClient.post<TierCostEstimate>(
        '/vfs/tiers/estimate',
        {
          sourceId,
          paths,
          targetTier,
        },
      );
      return response.data;
    } catch {
      // Return mock estimate for demo
      return this.getMockCostEstimate(paths, targetTier);
    }
  }

  /**
   * Request hydration/tier migration for files
   * This initiates moving files to a different storage tier
   */
  async requestHydration(request: HydrationRequest): Promise<HydrationJob> {
    try {
      const response = await apiClient.post<HydrationJob>(
        '/vfs/tiers/hydrate',
        request,
      );
      return response.data;
    } catch {
      // Return mock job for demo
      return this.getMockHydrationJob(request);
    }
  }

  /**
   * Get status of a hydration job
   */
  async getHydrationJobStatus(jobId: string): Promise<HydrationJob> {
    const response = await apiClient.get<HydrationJob>(
      `/vfs/tiers/jobs/${jobId}`,
    );
    return response.data;
  }

  /**
   * List active hydration jobs
   */
  async listHydrationJobs(sourceId?: string): Promise<HydrationJob[]> {
    const url = sourceId
      ? `/vfs/tiers/jobs?sourceId=${sourceId}`
      : '/vfs/tiers/jobs';
    const response = await apiClient.get<HydrationJob[]>(url);
    return response.data;
  }

  /**
   * Cancel a hydration job
   */
  async cancelHydrationJob(jobId: string): Promise<void> {
    await apiClient.delete(`/vfs/tiers/jobs/${jobId}`);
  }

  /**
   * Change file tier (shortcut for single file)
   */
  async changeTier(
    sourceId: string,
    path: string,
    targetTier: TierType,
  ): Promise<void> {
    await this.requestHydration({
      sourceId,
      paths: [path],
      targetTier,
    });
  }

  // Default tier configurations (AWS-based)
  private getDefaultTierConfigs(): TierConfig[] {
    return [
      {
        id: 'hot',
        name: 'Hot',
        description: 'FSx for ONTAP - High performance SSD storage',
        provider: 'fsx-ontap',
        retrievalTime: 'Instant',
        costPerGB: 0.25,
        accessFrequency: 'Frequently accessed',
      },
      {
        id: 'warm',
        name: 'Warm',
        description: 'FSx ONTAP Capacity Pool - Cost-optimized storage',
        provider: 'fsx-ontap-capacity',
        retrievalTime: '< 1 minute',
        costPerGB: 0.05,
        accessFrequency: 'Occasionally accessed',
      },
      {
        id: 'nearline',
        name: 'Nearline',
        description: 'S3 Standard - Metadata available, data in cloud',
        provider: 's3-standard',
        retrievalTime: '1-5 minutes',
        costPerGB: 0.023,
        accessFrequency: 'Infrequent access',
      },
      {
        id: 'cold',
        name: 'Cold',
        description: 'S3 Glacier Instant Retrieval',
        provider: 's3-glacier-ir',
        retrievalTime: 'Milliseconds',
        costPerGB: 0.004,
        accessFrequency: 'Rarely accessed',
      },
      {
        id: 'archive',
        name: 'Archive',
        description: 'S3 Glacier Deep Archive',
        provider: 's3-glacier-deep',
        retrievalTime: '12-48 hours',
        costPerGB: 0.00099,
        accessFrequency: 'Long-term archive',
      },
    ];
  }

  private getMockCostEstimate(
    paths: string[],
    targetTier: TierType,
  ): TierCostEstimate {
    const totalBytes = paths.length * 100 * 1024 * 1024; // Assume 100MB average
    const costPerGB =
      targetTier === 'hot' ? 0.03 : targetTier === 'warm' ? 0.01 : 0.004;

    return {
      totalBytes,
      retrievalCost: (totalBytes / (1024 * 1024 * 1024)) * costPerGB,
      storageCostDelta: 0.05,
      estimatedTime: targetTier === 'hot' ? '2-5 minutes' : '5-15 minutes',
    };
  }

  private getMockHydrationJob(request: HydrationRequest): HydrationJob {
    const totalBytes = request.paths.length * 100 * 1024 * 1024;
    return {
      id: `job-${Date.now()}`,
      sourceId: request.sourceId,
      paths: request.paths,
      targetTier: request.targetTier,
      status: 'queued',
      progress: 0,
      filesCompleted: 0,
      filesTotal: request.paths.length,
      bytesTransferred: 0,
      bytesTotal: totalBytes,
      estimatedCost: (totalBytes / (1024 * 1024 * 1024)) * 0.03,
      startedAt: new Date().toISOString(),
    };
  }

  // Demo data for development
  private getDemoSources(): StorageSource[] {
    return [
      {
        id: 'local-1',
        name: 'Local Storage',
        providerId: 'local',
        category: 'local',
        status: 'connected',
        usedSpace: 256000000000,
        totalSpace: 512000000000,
      },
      {
        id: 's3-1',
        name: 'AWS S3 Bucket',
        providerId: 's3',
        category: 'cloud',
        config: { bucket: 'ursly-assets', region: 'us-east-1' },
        status: 'connected',
      },
      {
        id: 'gcs-1',
        name: 'GCS Bucket',
        providerId: 'gcs',
        category: 'cloud',
        config: { bucket: 'ursly-media' },
        status: 'disconnected',
      },
      {
        id: 'smb-1',
        name: 'NAS Storage',
        providerId: 'smb',
        category: 'network',
        config: { path: '//nas.local/media' },
        status: 'connected',
      },
      {
        id: 'fsxn-1',
        name: 'FSx for NetApp',
        providerId: 'fsx-ontap',
        category: 'hybrid',
        status: 'connected',
      },
    ];
  }

  private getDemoFiles(path: string): FileMetadata[] {
    const now = new Date().toISOString();
    return [
      {
        id: '1',
        name: 'Documents',
        path: `${path}/Documents`,
        isDirectory: true,
        size: 0,
        sizeHuman: '--',
        mimeType: 'folder',
        lastModified: now,
        tierStatus: 'hot',
      },
      {
        id: '2',
        name: 'Projects',
        path: `${path}/Projects`,
        isDirectory: true,
        size: 0,
        sizeHuman: '--',
        mimeType: 'folder',
        lastModified: now,
        tierStatus: 'hot',
      },
      {
        id: '3',
        name: 'Media',
        path: `${path}/Media`,
        isDirectory: true,
        size: 0,
        sizeHuman: '--',
        mimeType: 'folder',
        lastModified: now,
        tierStatus: 'warm',
      },
      {
        id: '4',
        name: 'project-spec.pdf',
        path: `${path}/project-spec.pdf`,
        isDirectory: false,
        size: 2500000,
        sizeHuman: '2.5 MB',
        mimeType: 'application/pdf',
        lastModified: now,
        tierStatus: 'hot',
        canTranscode: false,
      },
      {
        id: '5',
        name: 'demo-video.mp4',
        path: `${path}/demo-video.mp4`,
        isDirectory: false,
        size: 150000000,
        sizeHuman: '150 MB',
        mimeType: 'video/mp4',
        lastModified: now,
        tierStatus: 'cold',
        isFavorite: true,
        canWarm: true,
        canTranscode: true,
      },
      {
        id: '6',
        name: 'backup-2024.zip',
        path: `${path}/backup-2024.zip`,
        isDirectory: false,
        size: 5000000000,
        sizeHuman: '5 GB',
        mimeType: 'application/zip',
        lastModified: now,
        tierStatus: 'archive',
      },
    ];
  }
}

export const StorageService = new StorageServiceClass();
