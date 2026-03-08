import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { LinkedinController } from './linkedin.controller';
import { LinkedinService } from './linkedin.service';

@Module({
  controllers: [LinkedinController],
  providers: [LinkedinService, PrismaService, EventsService],
})
export class LinkedinModule {}
