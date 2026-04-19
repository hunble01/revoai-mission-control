import { Module } from '@nestjs/common';
import { DraftsController } from './drafts.controller';
import { DraftsService } from './drafts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsModule } from '../settings/settings.module';
import { UnsubscribeModule } from '../unsubscribe/unsubscribe.module';

@Module({
  imports: [SettingsModule, UnsubscribeModule],
  controllers: [DraftsController],
  providers: [DraftsService, PrismaService],
})
export class DraftsModule {}
