import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AgentsModule } from './agents/agents.module';
import { ModelsModule } from './models/models.module';
import { TasksModule } from './tasks/tasks.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { RealtimeModule } from './realtime/realtime.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FileMetadataModule } from './file-metadata/file-metadata.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    RealtimeModule, // Global real-time event broadcasting
    NotificationsModule, // Novu in-app and email notifications
    AuthModule, // Auth guard must be registered BEFORE EntitlementGuard
    EntitlementsModule, // Entitlement-based authorization system (guards run after AuthModule)
    AgentsModule,
    ModelsModule,
    TasksModule,
    AuditModule,
    HealthModule,
    FileMetadataModule, // VFS file tags, favorites, ratings
  ],
})
export class AppModule {}
