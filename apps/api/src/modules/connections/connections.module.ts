import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';

@Module({
  controllers: [ConnectionsController],
  providers: [ConnectionsService, PrismaService],
})
export class ConnectionsModule {}
