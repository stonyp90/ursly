import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FileMetadataController } from './file-metadata.controller';
import { FileMetadataService } from './file-metadata.service';
import { FileMetadataRepositoryAdapter } from './adapters/file-metadata.repository.adapter';
import { FileMetadataSchema } from './adapters/file-metadata.schema';
import { FILE_METADATA_REPOSITORY } from './ports/file-metadata.repository.port';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'FileMetadata', schema: FileMetadataSchema },
    ]),
    AuthModule,
  ],
  controllers: [FileMetadataController],
  providers: [
    FileMetadataService,
    {
      provide: FILE_METADATA_REPOSITORY,
      useClass: FileMetadataRepositoryAdapter,
    },
  ],
  exports: [FileMetadataService],
})
export class FileMetadataModule {}
