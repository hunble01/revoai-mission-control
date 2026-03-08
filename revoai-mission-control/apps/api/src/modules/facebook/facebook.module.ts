import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { FacebookController } from './facebook.controller';
import { FacebookService } from './facebook.service';

@Module({
  controllers: [FacebookController],
  providers: [FacebookService, PrismaService, EventsService],
})
export class FacebookModule {}
