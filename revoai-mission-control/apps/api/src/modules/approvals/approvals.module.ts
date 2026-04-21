import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsListController } from './approvals-list.controller';
import { ApprovalsService } from './approvals.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [ApprovalsController, ApprovalsListController],
  providers: [ApprovalsService, PrismaService],
})
export class ApprovalsModule {}
