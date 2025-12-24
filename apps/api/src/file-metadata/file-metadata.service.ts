import { Injectable, Inject } from '@nestjs/common';
import {
  IFileMetadataRepository,
  FILE_METADATA_REPOSITORY,
} from './ports/file-metadata.repository.port';
import {
  FileMetadataResponse,
  FileTagDto,
  AllTagsResponse,
  PathListResponse,
} from './dto';

@Injectable()
export class FileMetadataService {
  constructor(
    @Inject(FILE_METADATA_REPOSITORY)
    private readonly repository: IFileMetadataRepository,
  ) {}

  /**
   * Get metadata for a file
   */
  async getMetadata(
    organizationId: string,
    sourceId: string,
    path: string,
  ): Promise<FileMetadataResponse | null> {
    return this.repository.get(organizationId, sourceId, path);
  }

  /**
   * Add a tag to a file
   */
  async addTag(
    organizationId: string,
    sourceId: string,
    path: string,
    tag: FileTagDto,
    userId: string,
  ): Promise<FileMetadataResponse> {
    return this.repository.addTag(organizationId, sourceId, path, tag, userId);
  }

  /**
   * Remove a tag from a file
   */
  async removeTag(
    organizationId: string,
    sourceId: string,
    path: string,
    tagName: string,
    userId: string,
  ): Promise<FileMetadataResponse | null> {
    return this.repository.removeTag(
      organizationId,
      sourceId,
      path,
      tagName,
      userId,
    );
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(
    organizationId: string,
    sourceId: string,
    path: string,
    userId: string,
  ): Promise<{ isFavorite: boolean }> {
    const result = await this.repository.toggleFavorite(
      organizationId,
      sourceId,
      path,
      userId,
    );
    return { isFavorite: result.isFavorite };
  }

  /**
   * Set favorite status explicitly
   */
  async setFavorite(
    organizationId: string,
    sourceId: string,
    path: string,
    isFavorite: boolean,
    userId: string,
  ): Promise<FileMetadataResponse> {
    return this.repository.setFavorite(
      organizationId,
      sourceId,
      path,
      isFavorite,
      userId,
    );
  }

  /**
   * Set color label
   */
  async setColorLabel(
    organizationId: string,
    sourceId: string,
    path: string,
    colorLabel: string | null,
    userId: string,
  ): Promise<FileMetadataResponse> {
    return this.repository.upsert(
      organizationId,
      sourceId,
      path,
      { colorLabel },
      userId,
    );
  }

  /**
   * Set rating
   */
  async setRating(
    organizationId: string,
    sourceId: string,
    path: string,
    rating: number | null,
    userId: string,
  ): Promise<FileMetadataResponse> {
    return this.repository.upsert(
      organizationId,
      sourceId,
      path,
      { rating },
      userId,
    );
  }

  /**
   * Set comment
   */
  async setComment(
    organizationId: string,
    sourceId: string,
    path: string,
    comment: string | null,
    userId: string,
  ): Promise<FileMetadataResponse> {
    return this.repository.upsert(
      organizationId,
      sourceId,
      path,
      { comment },
      userId,
    );
  }

  /**
   * List all favorites
   */
  async listFavorites(
    organizationId: string,
    sourceId: string,
  ): Promise<PathListResponse> {
    const paths = await this.repository.listFavorites(organizationId, sourceId);
    return { paths };
  }

  /**
   * List files by tag
   */
  async listByTag(
    organizationId: string,
    sourceId: string,
    tagName: string,
  ): Promise<PathListResponse> {
    const paths = await this.repository.listByTag(
      organizationId,
      sourceId,
      tagName,
    );
    return { paths };
  }

  /**
   * List files by color
   */
  async listByColor(
    organizationId: string,
    sourceId: string,
    colorLabel: string,
  ): Promise<PathListResponse> {
    const paths = await this.repository.listByColor(
      organizationId,
      sourceId,
      colorLabel,
    );
    return { paths };
  }

  /**
   * Get all unique tags
   */
  async listAllTags(
    organizationId: string,
    sourceId: string,
  ): Promise<AllTagsResponse> {
    const tags = await this.repository.listAllTags(organizationId, sourceId);
    return { tags };
  }

  /**
   * Batch sync from client (localStorage -> DB)
   */
  async batchSync(
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
    userId: string,
  ): Promise<{ synced: number; failed: number }> {
    return this.repository.batchSync(organizationId, items, userId);
  }

  /**
   * Delete metadata for a file
   */
  async deleteMetadata(
    organizationId: string,
    sourceId: string,
    path: string,
  ): Promise<boolean> {
    return this.repository.delete(organizationId, sourceId, path);
  }
}
