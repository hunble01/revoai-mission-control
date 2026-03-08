import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { LinkedinDmController } from './linkedin-dm.controller';
import { LinkedinDmService } from './linkedin-dm.service';

@Module({
  controllers: [LinkedinDmController],
  providers: [LinkedinDmService, PrismaService, EventsService],
})
export class LinkedinDmModule {}
