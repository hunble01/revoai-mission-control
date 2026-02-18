import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [ApprovalsController],
  providers: [ApprovalsService, PrismaService],
})
export class ApprovalsModule {}
