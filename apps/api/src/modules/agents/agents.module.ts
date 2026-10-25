import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [AgentsController],
  providers: [AgentsService, PrismaService],
})
export class AgentsModule {}
