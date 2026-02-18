import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class SchedulerService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  listJobs() {
    return this.prisma.schedulerJob.findMany({ orderBy: { createdAt: 'asc' } });
  }

  createJob(data: any) {
    return this.prisma.schedulerJob.create({ data });
  }

  updateJob(id: string, data: any) {
    return this.prisma.schedulerJob.update({ where: { id }, data });
  }

  listRuns() {
    return this.prisma.schedulerRun.findMany({ orderBy: { startedAt: 'desc' }, take: 100 });
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let attempt = 0;
    // simple backoff policy to avoid rapid 429 loops
    while (true) {
      try {
        return await fn();
      } catch (err: any) {
        attempt += 1;
        if (attempt > maxRetries) throw err;
        const backoff = 300 * Math.pow(2, attempt);
        await sleep(backoff);
      }
    }
  }

  private async getActiveCampaignId() {
    const c = await this.prisma.campaign.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    return c?.id;
  }

  private async runLeadResearch(campaignId?: string) {
    if (!campaignId) return { leads: 0 };
    const created = await this.prisma.lead.createMany({
      data: [
        {
          campaignId,
          businessName: 'North Star Plumbing',
          niche: 'Home services',
          region: 'Toronto, ON',
          website: 'https://northstarplumbing.example',
          source: 'manual_research',
          leadScore: 'B',
          status: 'NEW',
          notes: ['No booking CTA visible', 'Likely after-hours missed calls'],
        },
        {
          campaignId,
          businessName: 'Downtown Skin Clinic',
          niche: 'Beauty/Med-spa',
          region: 'Toronto, ON',
          website: 'https://downtownskin.example',
          source: 'manual_research',
          leadScore: 'A',
          status: 'NEW',
          notes: ['Strong reviews, weak response path'],
        },
      ],
      skipDuplicates: true,
    });
    return { leads: created.count };
  }

  private async runEnrichmentScoring(campaignId?: string) {
    if (!campaignId) return { enriched: 0 };
    const leads = await this.prisma.lead.findMany({ where: { campaignId }, take: 10 });
    for (const l of leads) {
      await this.prisma.lead.update({
        where: { id: l.id },
        data: {
          contactName: l.contactName || 'Owner',
          contactRole: l.contactRole || 'Owner',
          email: l.email || `${l.businessName.toLowerCase().replace(/\s+/g, '')}@example.com`,
          status: 'ENRICHED',
          lastActionAt: new Date(),
        },
      });
    }
    return { enriched: leads.length };
  }

  private async runOutreachDrafting(campaignId?: string) {
    if (!campaignId) return { drafts: 0 };
    const leads = await this.prisma.lead.findMany({ where: { campaignId, status: { in: ['ENRICHED', 'NEW'] } }, take: 5 });
    let count = 0;
    for (const l of leads) {
      const draft = await this.prisma.draft.create({
        data: {
          campaignId,
          leadId: l.id,
          channel: 'LINKEDIN',
          draftType: 'first_message',
          status: 'NEEDS_APPROVAL',
        },
      });
      await this.prisma.draftVersion.create({
        data: {
          draftId: draft.id,
          versionNumber: 1,
          content: `Hi ${l.contactName || 'there'}, noticed ${l.businessName} may be missing instant follow-up on inbound leads.`,
          changeNote: 'Auto-generated draft (dry-run)',
        },
      });
      await this.prisma.lead.update({ where: { id: l.id }, data: { status: 'DRAFTED', lastActionAt: new Date() } });
      count += 1;
    }
    return { drafts: count };
  }

  private async runContentDrafting(campaignId?: string) {
    if (!campaignId) return { contentDrafts: 0 };
    const draft = await this.prisma.draft.create({
      data: {
        campaignId,
        channel: 'LINKEDIN',
        draftType: 'content_script',
        status: 'NEEDS_APPROVAL',
      },
    });
    await this.prisma.draftVersion.create({
      data: {
        draftId: draft.id,
        versionNumber: 1,
        content: '3 reasons local businesses lose booked appointments after ad clicks (and how to fix it).',
        changeNote: 'Content draft (dry-run)',
      },
    });
    return { contentDrafts: 1 };
  }

  private async runDailyBrief(campaignId?: string) {
    const summary = {
      wins: ['Leads researched', 'Draft queue filled', 'Approvals ready'],
      blockers: ['Some leads missing direct contact info', 'Manual review pending', 'No external send in dry-run'],
      nextMoves: ['Approve top drafts', 'Refine templates', 'Run second enrichment pass'],
    };

    await this.events.publish({ eventType: 'daily_brief.generated', campaignId, payload: summary });
    return summary;
  }

  async runNow(id: string) {
    const job = await this.prisma.schedulerJob.findUnique({ where: { id } });
    if (!job) throw new Error('Job not found');

    const campaignId = job.campaignId || (await this.getActiveCampaignId());

    await this.events.publish({ eventType: 'scheduler.job.started', campaignId, payload: { jobId: id, jobName: job.name } });

    const run = await this.prisma.schedulerRun.create({
      data: { jobId: id, status: 'running', summary: {} },
    });

    try {
      const summary = await this.withRetry(async () => {
        if (job.name.includes('Lead Research')) return this.runLeadResearch(campaignId);
        if (job.name.includes('Enrichment')) return this.runEnrichmentScoring(campaignId);
        if (job.name.includes('Outreach')) return this.runOutreachDrafting(campaignId);
        if (job.name.includes('Content')) return this.runContentDrafting(campaignId);
        if (job.name.includes('Daily Brief')) return this.runDailyBrief(campaignId);
        return { ok: true };
      });

      const done = await this.prisma.schedulerRun.update({
        where: { id: run.id },
        data: { status: 'completed', finishedAt: new Date(), summary: { ...summary, dryRun: true } },
      });

      await this.events.publish({
        eventType: 'scheduler.job.completed',
        campaignId,
        payload: { jobId: id, runId: run.id, dryRun: true, summary },
      });

      return done;
    } catch (error: any) {
      const failed = await this.prisma.schedulerRun.update({
        where: { id: run.id },
        data: { status: 'failed', finishedAt: new Date(), summary: { error: error.message } },
      });
      await this.events.publish({
        eventType: 'scheduler.job.failed',
        campaignId,
        payload: { jobId: id, runId: run.id, error: error.message },
      });
      return failed;
    }
  }

  async seedDefaultPipeline(campaignId?: string) {
    const defaults = [
      { name: '09:00 Lead Research', cronExpr: '0 9 * * *' },
      { name: '09:30 Enrichment + scoring', cronExpr: '30 9 * * *' },
      { name: '10:30 Outreach Drafting + QA', cronExpr: '30 10 * * *' },
      { name: '12:00 Content Research + Creation + QA', cronExpr: '0 12 * * *' },
      { name: '16:30 Daily Brief', cronExpr: '30 16 * * *' },
    ];

    const created = [];
    for (const d of defaults) {
      created.push(await this.prisma.schedulerJob.create({
        data: {
          campaignId,
          name: d.name,
          cronExpr: d.cronExpr,
          timezone: 'America/Toronto',
          enabled: true,
          config: {},
        },
      }));
    }
    return created;
  }
}
