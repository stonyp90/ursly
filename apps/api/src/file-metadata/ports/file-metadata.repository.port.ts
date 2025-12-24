import { FileMetadataResponse, FileTagDto } from '../dto';

/**
 * Port interface for file metadata repository
 * Follows Clean Architecture pattern
 */
export interface IFileMetadataRepository {
  /**
   * Get metadata for a specific file
   */
  get(
    organizationId: string,
    sourceId: string,
    path: string,
  ): Promise<FileMetadataResponse | null>;

  /**
   * Create or update file metadata
   */
  upsert(
    organizationId: string,
    sourceId: string,
    path: string,
    data: Partial<{
      tags: FileTagDto[];
      isFavorite: boolean;
      colorLabel: string | null;
      rating: number | null;
      comment: string | null;
    }>,
    modifiedBy: string,
  ): Promise<FileMetadataResponse>;

  /**
   * Delete metadata for a file
   */
  delete(
    organizationId: string,
    sourceId: string,
    path: string,
  ): Promise<boolean>;

  /**
   * Add a tag to a file
   */
  addTag(
    organizationId: string,
    sourceId: string,
    path: string,
    tag: FileTagDto,
    modifiedBy: string,
  ): Promise<FileMetadataResponse>;

  /**
   * Remove a tag from a file
   */
  removeTag(
    organizationId: string,
    sourceId: string,
    path: string,
    tagName: string,
    modifiedBy: string,
  ): Promise<FileMetadataResponse | null>;

  /**
   * Set favorite status
   */
  setFavorite(
    organizationId: string,
    sourceId: string,
    path: string,
    isFavorite: boolean,
    modifiedBy: string,
  ): Promise<FileMetadataResponse>;

  /**
   * Toggle favorite status
   */
  toggleFavorite(
    organizationId: string,
    sourceId: string,
    path: string,
    modifiedBy: string,
  ): Promise<{ isFavorite: boolean; metadata: FileMetadataResponse }>;

  /**
   * List all favorites for a source
   */
  listFavorites(organizationId: string, sourceId: string): Promise<string[]>;

  /**
   * List files with a specific tag
   */
  listByTag(
    organizationId: string,
    sourceId: string,
    tagName: string,
  ): Promise<string[]>;

  /**
   * List files with a specific color label
   */
  listByColor(
    organizationId: string,
    sourceId: string,
    colorLabel: string,
  ): Promise<string[]>;

  /**
   * Get all unique tags for a source
   */
  listAllTags(organizationId: string, sourceId: string): Promise<FileTagDto[]>;

  /**
   * Batch sync multiple file metadata entries
   */
  batchSync(
    organizationId: string,
    items: Array<{
      sourceId: string;
      path: string;
      tags?: FileTagDto[];
      isFavorite?: boolean;
      colorLabel?: string | null;
      rating?: number | null;
      comment?: string | null;
    }>,
    modifiedBy: string,
  ): Promise<{ synced: number; failed: number }>;
}

export const FILE_METADATA_REPOSITORY = Symbol('IFileMetadataRepository');
