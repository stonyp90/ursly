import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

import { IFileMetadataRepository } from '../ports/file-metadata.repository.port';
import { FileMetadataDocument } from './file-metadata.schema';
import { FileMetadataResponse, FileTagDto } from '../dto';

@Injectable()
export class FileMetadataRepositoryAdapter implements IFileMetadataRepository {
  constructor(
    @InjectModel('FileMetadata')
    private readonly metadataModel: Model<FileMetadataDocument>,
  ) {}

  private toResponse(doc: FileMetadataDocument): FileMetadataResponse {
    return {
      id: doc._id.toString(),
      sourceId: doc.sourceId,
      path: doc.path,
      tags: doc.tags.map((t) => ({ name: t.name, color: t.color })),
      isFavorite: doc.isFavorite,
      colorLabel: doc.colorLabel || null,
      rating: doc.rating ?? null,
      comment: doc.comment || null,
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  async get(
    organizationId: string,
    sourceId: string,
    path: string,
  ): Promise<FileMetadataResponse | null> {
    const doc = await this.metadataModel
      .findOne({ organizationId, sourceId, path })
      .lean()
      .exec();

    if (!doc) return null;
    return this.toResponse(doc as unknown as FileMetadataDocument);
  }

  async upsert(
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
  ): Promise<FileMetadataResponse> {
    const doc = await this.metadataModel
      .findOneAndUpdate(
        { organizationId, sourceId, path },
        {
          $set: {
            ...data,
            modifiedBy,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            _id: uuidv4(),
            organizationId,
            sourceId,
            path,
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true },
      )
      .lean()
      .exec();

    return this.toResponse(doc as unknown as FileMetadataDocument);
  }

  async delete(
    organizationId: string,
    sourceId: string,
    path: string,
  ): Promise<boolean> {
    const result = await this.metadataModel
      .deleteOne({ organizationId, sourceId, path })
      .exec();
    return result.deletedCount > 0;
  }

  async addTag(
    organizationId: string,
    sourceId: string,
    path: string,
    tag: FileTagDto,
    modifiedBy: string,
  ): Promise<FileMetadataResponse> {
    const doc = await this.metadataModel
      .findOneAndUpdate(
        { organizationId, sourceId, path },
        {
          $addToSet: { tags: tag },
          $set: { modifiedBy, updatedAt: new Date() },
          $setOnInsert: {
            _id: uuidv4(),
            organizationId,
            sourceId,
            path,
            isFavorite: false,
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true },
      )
      .lean()
      .exec();

    return this.toResponse(doc as unknown as FileMetadataDocument);
  }

  async removeTag(
    organizationId: string,
    sourceId: string,
    path: string,
    tagName: string,
    modifiedBy: string,
  ): Promise<FileMetadataResponse | null> {
    const doc = await this.metadataModel
      .findOneAndUpdate(
        { organizationId, sourceId, path },
        {
          $pull: { tags: { name: tagName } },
          $set: { modifiedBy, updatedAt: new Date() },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!doc) return null;
    return this.toResponse(doc as unknown as FileMetadataDocument);
  }

  async setFavorite(
    organizationId: string,
    sourceId: string,
    path: string,
    isFavorite: boolean,
    modifiedBy: string,
  ): Promise<FileMetadataResponse> {
    const doc = await this.metadataModel
      .findOneAndUpdate(
        { organizationId, sourceId, path },
        {
          $set: { isFavorite, modifiedBy, updatedAt: new Date() },
          $setOnInsert: {
            _id: uuidv4(),
            organizationId,
            sourceId,
            path,
            tags: [],
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true },
      )
      .lean()
      .exec();

    return this.toResponse(doc as unknown as FileMetadataDocument);
  }

  async toggleFavorite(
    organizationId: string,
    sourceId: string,
    path: string,
    modifiedBy: string,
  ): Promise<{ isFavorite: boolean; metadata: FileMetadataResponse }> {
    // First get current state
    let doc = await this.metadataModel
      .findOne({ organizationId, sourceId, path })
      .lean()
      .exec();

    const newFavoriteState = !doc?.isFavorite;

    // Update with new state
    doc = await this.metadataModel
      .findOneAndUpdate(
        { organizationId, sourceId, path },
        {
          $set: {
            isFavorite: newFavoriteState,
            modifiedBy,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            _id: uuidv4(),
            organizationId,
            sourceId,
            path,
            tags: [],
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true },
      )
      .lean()
      .exec();

    return {
      isFavorite: newFavoriteState,
      metadata: this.toResponse(doc as unknown as FileMetadataDocument),
    };
  }

  async listFavorites(
    organizationId: string,
    sourceId: string,
  ): Promise<string[]> {
    const docs = await this.metadataModel
      .find({ organizationId, sourceId, isFavorite: true })
      .select('path')
      .lean()
      .exec();

    return docs.map((d) => d.path);
  }

  async listByTag(
    organizationId: string,
    sourceId: string,
    tagName: string,
  ): Promise<string[]> {
    const docs = await this.metadataModel
      .find({ organizationId, sourceId, 'tags.name': tagName })
      .select('path')
      .lean()
      .exec();

    return docs.map((d) => d.path);
  }

  async listByColor(
    organizationId: string,
    sourceId: string,
    colorLabel: string,
  ): Promise<string[]> {
    const docs = await this.metadataModel
      .find({ organizationId, sourceId, colorLabel })
      .select('path')
      .lean()
      .exec();

    return docs.map((d) => d.path);
  }

  async listAllTags(
    organizationId: string,
    sourceId: string,
  ): Promise<FileTagDto[]> {
    const docs = await this.metadataModel
      .find({ organizationId, sourceId, 'tags.0': { $exists: true } })
      .select('tags')
      .lean()
      .exec();

    // Flatten and deduplicate tags
    const tagMap = new Map<string, FileTagDto>();
    for (const doc of docs) {
      for (const tag of doc.tags) {
        if (!tagMap.has(tag.name)) {
          tagMap.set(tag.name, { name: tag.name, color: tag.color });
        }
      }
    }

    return Array.from(tagMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

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
    modifiedBy: string,
  ): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    const bulkOps = items.map((item) => ({
      updateOne: {
        filter: { organizationId, sourceId: item.sourceId, path: item.path },
        update: {
          $set: {
            tags: item.tags ?? [],
            isFavorite: item.isFavorite ?? false,
            colorLabel: item.colorLabel,
            rating: item.rating,
            comment: item.comment,
            modifiedBy,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            _id: uuidv4(),
            organizationId,
            sourceId: item.sourceId,
            path: item.path,
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await this.metadataModel.bulkWrite(bulkOps as any);
      synced = result.upsertedCount + result.modifiedCount;
    } catch (error) {
      failed = items.length;
    }

    return { synced, failed };
  }
}
