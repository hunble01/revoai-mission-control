import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { FacebookController } from './facebook.controller';
import { FacebookService } from './facebook.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [FacebookController],
  providers: [FacebookService, PrismaService, EventsService],
})
export class FacebookModule {}
