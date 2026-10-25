import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { InstagramController } from './instagram.controller';
import { InstagramService } from './instagram.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [InstagramController],
  providers: [InstagramService, PrismaService, EventsService],
  exports: [InstagramService],
})
export class InstagramModule {}
