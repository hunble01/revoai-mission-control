import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignAutorunService } from './campaign-autorun.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { ResearchModule } from '../research/research.module';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [ResearchModule, LeadsModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignAutorunService, PrismaService, EventsService],
})
export class CampaignsModule {}
