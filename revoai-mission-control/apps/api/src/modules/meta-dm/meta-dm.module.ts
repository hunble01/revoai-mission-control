import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { MetaDmController } from './meta-dm.controller';
import { MetaDmService } from './meta-dm.service';

@Module({
  controllers: [MetaDmController],
  providers: [MetaDmService, PrismaService, EventsService],
  exports: [MetaDmService],
})
export class MetaDmModule {}
