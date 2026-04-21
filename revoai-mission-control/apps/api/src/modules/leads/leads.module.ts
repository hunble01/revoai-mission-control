import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { FollowUpService } from './followup.service';
import { FollowUpController } from './followup.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [LeadsController, FollowUpController],
  providers: [LeadsService, FollowUpService, PrismaService],
  exports: [LeadsService, FollowUpService],
})
export class LeadsModule {}
