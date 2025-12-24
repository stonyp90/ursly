import { z } from 'zod';

// ============================================================================
// File Tag DTOs
// ============================================================================

export const FileTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

export type FileTagDto = z.infer<typeof FileTagSchema>;

// ============================================================================
// File Metadata DTOs
// ============================================================================

export const FileMetadataSchema = z.object({
  sourceId: z.string().min(1),
  path: z.string().min(1),
  tags: z.array(FileTagSchema).default([]),
  isFavorite: z.boolean().default(false),
  colorLabel: z
    .enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'])
    .nullable()
    .optional(),
  rating: z.number().int().min(0).max(5).nullable().optional(),
  comment: z.string().max(1000).nullable().optional(),
});

export type FileMetadataDto = z.infer<typeof FileMetadataSchema>;

export const CreateFileMetadataSchema = FileMetadataSchema;
export type CreateFileMetadataDto = FileMetadataDto;

export const UpdateFileMetadataSchema = FileMetadataSchema.partial().required({
  sourceId: true,
  path: true,
});
export type UpdateFileMetadataDto = z.infer<typeof UpdateFileMetadataSchema>;

// ============================================================================
// Request/Response DTOs
// ============================================================================

export const AddTagRequestSchema = z.object({
  sourceId: z.string().min(1),
  path: z.string().min(1),
  tag: FileTagSchema,
});
export type AddTagRequestDto = z.infer<typeof AddTagRequestSchema>;

export const RemoveTagRequestSchema = z.object({
  sourceId: z.string().min(1),
  path: z.string().min(1),
  tagName: z.string().min(1),
});
export type RemoveTagRequestDto = z.infer<typeof RemoveTagRequestSchema>;

export const SetFavoriteRequestSchema = z.object({
  sourceId: z.string().min(1),
  path: z.string().min(1),
  isFavorite: z.boolean(),
});
export type SetFavoriteRequestDto = z.infer<typeof SetFavoriteRequestSchema>;

export const SetColorLabelRequestSchema = z.object({
  sourceId: z.string().min(1),
  path: z.string().min(1),
  colorLabel: z
    .enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'])
    .nullable(),
});
export type SetColorLabelRequestDto = z.infer<
  typeof SetColorLabelRequestSchema
>;

export const SetRatingRequestSchema = z.object({
  sourceId: z.string().min(1),
  path: z.string().min(1),
  rating: z.number().int().min(0).max(5).nullable(),
});
export type SetRatingRequestDto = z.infer<typeof SetRatingRequestSchema>;

export const SetCommentRequestSchema = z.object({
  sourceId: z.string().min(1),
  path: z.string().min(1),
  comment: z.string().max(1000).nullable(),
});
export type SetCommentRequestDto = z.infer<typeof SetCommentRequestSchema>;

// Batch sync item schema
export const BatchSyncItemSchema = z.object({
  sourceId: z.string().min(1),
  path: z.string().min(1),
  tags: z.array(FileTagSchema).optional(),
  isFavorite: z.boolean().optional(),
  colorLabel: z
    .enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'])
    .nullable()
    .optional(),
  rating: z.number().int().min(0).max(5).nullable().optional(),
  comment: z.string().max(1000).nullable().optional(),
});
export type BatchSyncItemDto = z.infer<typeof BatchSyncItemSchema>;

// Batch sync request (for syncing local storage to DB)
export const BatchSyncRequestSchema = z.object({
  items: z.array(BatchSyncItemSchema),
});
export type BatchSyncRequestDto = z.infer<typeof BatchSyncRequestSchema>;

// Query DTOs
export const ListByTagQuerySchema = z.object({
  sourceId: z.string().min(1),
  tagName: z.string().min(1),
});
export type ListByTagQueryDto = z.infer<typeof ListByTagQuerySchema>;

export const ListByColorQuerySchema = z.object({
  sourceId: z.string().min(1),
  colorLabel: z.enum([
    'red',
    'orange',
    'yellow',
    'green',
    'blue',
    'purple',
    'gray',
  ]),
});
export type ListByColorQueryDto = z.infer<typeof ListByColorQuerySchema>;

// Response types
export interface FileMetadataResponse {
  id: string;
  sourceId: string;
  path: string;
  tags: FileTagDto[];
  isFavorite: boolean;
  colorLabel: string | null;
  rating: number | null;
  comment: string | null;
  updatedAt: string;
}

export interface AllTagsResponse {
  tags: FileTagDto[];
}

export interface PathListResponse {
  paths: string[];
}
