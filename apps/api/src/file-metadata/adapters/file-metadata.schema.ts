import { Schema, Document } from 'mongoose';

/**
 * File Metadata Schema for MongoDB
 * Stores user-defined metadata for files across storage sources
 */

export interface FileTagDocument {
  name: string;
  color?: string;
}

export interface FileMetadataDocument extends Document {
  /** Storage source ID (e.g., 'local', 's3-bucket-1') */
  sourceId: string;

  /** File path within the storage source */
  path: string;

  /** User-defined tags */
  tags: FileTagDocument[];

  /** Is marked as favorite */
  isFavorite: boolean;

  /** Color label (red, orange, yellow, green, blue, purple, gray) */
  colorLabel?: string;

  /** User rating (0-5) */
  rating?: number;

  /** User comment/notes */
  comment?: string;

  /** Organization ID for multi-tenancy */
  organizationId: string;

  /** User who last modified */
  modifiedBy: string;

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

export const FileTagSchema = new Schema(
  {
    name: { type: String, required: true },
    color: { type: String },
  },
  { _id: false },
);

export const FileMetadataSchema = new Schema<FileMetadataDocument>(
  {
    sourceId: { type: String, required: true, index: true },
    path: { type: String, required: true },
    tags: { type: [FileTagSchema], default: [] },
    isFavorite: { type: Boolean, default: false, index: true },
    colorLabel: {
      type: String,
      enum: [
        'red',
        'orange',
        'yellow',
        'green',
        'blue',
        'purple',
        'gray',
        null,
      ],
    },
    rating: { type: Number, min: 0, max: 5 },
    comment: { type: String },
    organizationId: { type: String, required: true, index: true },
    modifiedBy: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'file_metadata',
  },
);

// Compound index for fast lookups
FileMetadataSchema.index(
  { sourceId: 1, path: 1, organizationId: 1 },
  { unique: true },
);

// Index for tag searches
FileMetadataSchema.index({ 'tags.name': 1, organizationId: 1 });

// Index for color label searches
FileMetadataSchema.index({ colorLabel: 1, organizationId: 1 });
