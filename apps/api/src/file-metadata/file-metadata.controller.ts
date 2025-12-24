import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileMetadataService } from './file-metadata.service';
import {
  AddTagRequestDto,
  RemoveTagRequestDto,
  SetFavoriteRequestDto,
  SetColorLabelRequestDto,
  SetRatingRequestDto,
  SetCommentRequestDto,
  BatchSyncRequestDto,
  FileMetadataResponse,
  AllTagsResponse,
  PathListResponse,
} from './dto';

interface AuthenticatedRequest {
  user: {
    sub: string;
    email: string;
    organizationId?: string;
  };
}

@ApiTags('file-metadata')
@ApiBearerAuth()
@Controller('file-metadata')
@UseGuards(JwtAuthGuard)
export class FileMetadataController {
  constructor(private readonly service: FileMetadataService) {}

  private getOrgId(req: AuthenticatedRequest): string {
    return req.user.organizationId || 'default';
  }

  private getUserId(req: AuthenticatedRequest): string {
    return req.user.sub;
  }

  // =========================================================================
  // Get Metadata
  // =========================================================================

  @Get(':sourceId')
  @ApiOperation({ summary: 'Get metadata for a file' })
  async getMetadata(
    @Req() req: AuthenticatedRequest,
    @Param('sourceId') sourceId: string,
    @Query('path') path: string,
  ): Promise<FileMetadataResponse | null> {
    return this.service.getMetadata(this.getOrgId(req), sourceId, path);
  }

  // =========================================================================
  // Tags
  // =========================================================================

  @Post('tags/add')
  @ApiOperation({ summary: 'Add a tag to a file' })
  async addTag(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AddTagRequestDto,
  ): Promise<FileMetadataResponse> {
    return this.service.addTag(
      this.getOrgId(req),
      dto.sourceId,
      dto.path,
      dto.tag,
      this.getUserId(req),
    );
  }

  @Post('tags/remove')
  @ApiOperation({ summary: 'Remove a tag from a file' })
  async removeTag(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RemoveTagRequestDto,
  ): Promise<FileMetadataResponse | null> {
    return this.service.removeTag(
      this.getOrgId(req),
      dto.sourceId,
      dto.path,
      dto.tagName,
      this.getUserId(req),
    );
  }

  @Get('tags/list/:sourceId')
  @ApiOperation({ summary: 'Get all unique tags for a source' })
  async listAllTags(
    @Req() req: AuthenticatedRequest,
    @Param('sourceId') sourceId: string,
  ): Promise<AllTagsResponse> {
    return this.service.listAllTags(this.getOrgId(req), sourceId);
  }

  @Get('tags/files/:sourceId')
  @ApiOperation({ summary: 'List files with a specific tag' })
  async listByTag(
    @Req() req: AuthenticatedRequest,
    @Param('sourceId') sourceId: string,
    @Query('tagName') tagName: string,
  ): Promise<PathListResponse> {
    return this.service.listByTag(this.getOrgId(req), sourceId, tagName);
  }

  // =========================================================================
  // Favorites
  // =========================================================================

  @Post('favorites/toggle')
  @ApiOperation({ summary: 'Toggle favorite status' })
  async toggleFavorite(
    @Req() req: AuthenticatedRequest,
    @Body() dto: { sourceId: string; path: string },
  ): Promise<{ isFavorite: boolean }> {
    return this.service.toggleFavorite(
      this.getOrgId(req),
      dto.sourceId,
      dto.path,
      this.getUserId(req),
    );
  }

  @Post('favorites/set')
  @ApiOperation({ summary: 'Set favorite status explicitly' })
  async setFavorite(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SetFavoriteRequestDto,
  ): Promise<FileMetadataResponse> {
    return this.service.setFavorite(
      this.getOrgId(req),
      dto.sourceId,
      dto.path,
      dto.isFavorite,
      this.getUserId(req),
    );
  }

  @Get('favorites/list/:sourceId')
  @ApiOperation({ summary: 'List all favorites for a source' })
  async listFavorites(
    @Req() req: AuthenticatedRequest,
    @Param('sourceId') sourceId: string,
  ): Promise<PathListResponse> {
    return this.service.listFavorites(this.getOrgId(req), sourceId);
  }

  // =========================================================================
  // Color Labels
  // =========================================================================

  @Post('color')
  @ApiOperation({ summary: 'Set color label' })
  async setColorLabel(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SetColorLabelRequestDto,
  ): Promise<FileMetadataResponse> {
    return this.service.setColorLabel(
      this.getOrgId(req),
      dto.sourceId,
      dto.path,
      dto.colorLabel,
      this.getUserId(req),
    );
  }

  @Get('color/files/:sourceId')
  @ApiOperation({ summary: 'List files with a specific color' })
  async listByColor(
    @Req() req: AuthenticatedRequest,
    @Param('sourceId') sourceId: string,
    @Query('color') colorLabel: string,
  ): Promise<PathListResponse> {
    return this.service.listByColor(this.getOrgId(req), sourceId, colorLabel);
  }

  // =========================================================================
  // Rating & Comment
  // =========================================================================

  @Post('rating')
  @ApiOperation({ summary: 'Set rating (0-5)' })
  async setRating(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SetRatingRequestDto,
  ): Promise<FileMetadataResponse> {
    return this.service.setRating(
      this.getOrgId(req),
      dto.sourceId,
      dto.path,
      dto.rating,
      this.getUserId(req),
    );
  }

  @Post('comment')
  @ApiOperation({ summary: 'Set comment' })
  async setComment(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SetCommentRequestDto,
  ): Promise<FileMetadataResponse> {
    return this.service.setComment(
      this.getOrgId(req),
      dto.sourceId,
      dto.path,
      dto.comment,
      this.getUserId(req),
    );
  }

  // =========================================================================
  // Batch Operations
  // =========================================================================

  @Post('sync')
  @ApiOperation({ summary: 'Batch sync metadata from client' })
  async batchSync(
    @Req() req: AuthenticatedRequest,
    @Body() dto: BatchSyncRequestDto,
  ): Promise<{ synced: number; failed: number }> {
    // Map items to ensure required fields are present
    const items = dto.items.map((item) => ({
      sourceId: item.sourceId,
      path: item.path,
      tags: item.tags,
      isFavorite: item.isFavorite,
      colorLabel: item.colorLabel,
      rating: item.rating,
      comment: item.comment,
    }));

    return this.service.batchSync(
      this.getOrgId(req),
      items,
      this.getUserId(req),
    );
  }

  // =========================================================================
  // Delete
  // =========================================================================

  @Delete(':sourceId')
  @ApiOperation({ summary: 'Delete metadata for a file' })
  async deleteMetadata(
    @Req() req: AuthenticatedRequest,
    @Param('sourceId') sourceId: string,
    @Query('path') path: string,
  ): Promise<{ deleted: boolean }> {
    const deleted = await this.service.deleteMetadata(
      this.getOrgId(req),
      sourceId,
      path,
    );
    return { deleted };
  }
}
