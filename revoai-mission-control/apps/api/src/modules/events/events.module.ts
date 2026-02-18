import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';

@Global()
@Module({
  providers: [PrismaService, EventsGateway, EventsService],
  exports: [EventsService, EventsGateway],
})
export class EventsModule {}
