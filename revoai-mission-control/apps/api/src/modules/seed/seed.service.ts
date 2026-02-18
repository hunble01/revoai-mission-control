import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class SeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
    private readonly events: EventsService,
  ) {}

  async load() {
    const campaign = await this.prisma.campaign.upsert({
      where: { id: '11111111-1111-1111-1111-111111111111' },
      update: {},
      create: {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Home Services Toronto Pilot',
        niche: 'Home services',
        geography: 'Toronto/GTA',
        minScore: 'B',
        outreachTemplates: {},
        contentThemes: ['missed-call recovery', 'speed-to-lead'],
        metrics: {},
      },
    });

    const settings = [
      { key: 'dry_run_mode', value: { enabled: true } },
      { key: 'outbound_channels', value: { email: false, facebook: false, instagram: false, linkedin: false } },
      { key: 'global_pause', value: { paused: false } },
    ];
    for (const s of settings) {
      await this.prisma.setting.upsert({ where: { key: s.key }, create: s, update: { value: s.value } });
    }

    const agents = ['Orchestrator','Lead Finder','Enrichment Agent','Copywriter','Content Agent','QA/Compliance Agent'];
    for (const name of agents) {
      await this.prisma.agent.upsert({
        where: { name },
        update: {},
        create: { name, status: 'IDLE', metadata: {} },
      });
    }

    const jobs = await this.scheduler.seedDefaultPipeline(campaign.id);

    const lead1 = await this.prisma.lead.create({
      data: {
        campaignId: campaign.id,
        businessName: 'Blue Maple HVAC',
        niche: 'Home services',
        region: 'Toronto, ON',
        website: 'https://bluemaplehvac.example',
        contactName: 'Owner',
        contactRole: 'Owner',
        email: 'owner@bluemaplehvac.example',
        source: 'seed',
        leadScore: 'A',
        status: 'ENRICHED',
        notes: ['No instant response', 'Weak booking CTA'],
      },
    });

    const draft1 = await this.prisma.draft.create({
      data: {
        campaignId: campaign.id,
        leadId: lead1.id,
        channel: 'LINKEDIN',
        draftType: 'first_message',
        status: 'NEEDS_APPROVAL',
      },
    });

    await this.prisma.draftVersion.create({
      data: {
        draftId: draft1.id,
        versionNumber: 1,
        content: 'Quick win: recover missed calls with instant SMS + booking flow.',
        changeNote: 'Seed draft',
      },
    });

    const task = await this.prisma.task.create({
      data: {
        campaignId: campaign.id,
        title: 'Review seeded LinkedIn draft',
        description: 'Admin review required',
        columnName: 'NEEDS_APPROVAL',
        priority: 'high',
        linkedLeadId: lead1.id,
        linkedDraftId: draft1.id,
      },
    });

    await this.events.publish({ eventType: 'seed.loaded', taskId: task.id, campaignId: campaign.id, payload: { campaignId: campaign.id } });

    return {
      campaign,
      jobsCount: jobs.length,
      seedLeadId: lead1.id,
      seedDraftId: draft1.id,
      seedTaskId: task.id,
    };
  }
}
