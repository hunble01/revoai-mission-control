import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { ResearchController } from './research.controller';
import { ResearchService } from './research.service';

@Module({
  controllers: [ResearchController],
  providers: [ResearchService, PrismaService, EventsService],
  exports: [ResearchService],
})
export class ResearchModule {}
