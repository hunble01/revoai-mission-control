import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { FollowUpService } from './followup.service';
import { FollowUpController } from './followup.controller';
import { ReplyPollerService } from './reply-poller.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UnsubscribeModule } from '../unsubscribe/unsubscribe.module';

@Module({
  imports: [UnsubscribeModule],
  controllers: [LeadsController, FollowUpController],
  providers: [LeadsService, FollowUpService, ReplyPollerService, PrismaService],
  exports: [LeadsService, FollowUpService],
})
export class LeadsModule {}
