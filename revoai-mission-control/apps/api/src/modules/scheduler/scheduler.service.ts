import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class SchedulerService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  private humanNextRun(cronExpr: string, timezone: string) {
    // lightweight placeholder until cron parser is introduced
    return `Next run based on ${cronExpr} (${timezone})`;
  }

  async listJobs() {
    const rows = await this.prisma.schedulerJob.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((r: any) => ({ ...r, nextRunHuman: this.humanNextRun(r.cronExpr, r.timezone || 'UTC') }));
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
    if (!campaignId) return { leads: 0, runId: null };

    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    const niche = campaign?.niche || 'Local Services';
    const city = campaign?.geographyCity || campaign?.geography || 'Toronto';

    const run = await this.prisma.researchRun.create({
      data: {
        campaignId,
        status: 'running',
        searchParams: {
          campaignId,
          niche,
          geographyCity: city,
          dailySendLimit: campaign?.dailySendLimit || 20,
        } as any,
        metadata: {
          source: 'scheduler',
          mode: 'daily_discovery',
          phase: 'Lead Discovery',
          progress: 20,
        } as any,
      },
    });

    const leadsSeed = [
      {
        companyName: `${city} ${niche} Pros`,
        contactName: 'Owner',
        email: `hello@${String(city).toLowerCase().replace(/\s+/g, '')}pros.example`,
        phone: '+1-416-555-0101',
        linkedinUrl: 'https://www.linkedin.com/company/example-pros',
        sourceUrl: `https://search.example/${encodeURIComponent(`${niche} ${city}`)}`,
        sourceType: 'research_agent',
        source: 'scheduler_daily_discovery',
        fitScore: 'Medium',
      },
      {
        companyName: `${city} ${niche} Group`,
        contactName: 'Founder',
        email: `bookings@${String(city).toLowerCase().replace(/\s+/g, '')}group.example`,
        phone: '+1-416-555-0102',
        linkedinUrl: 'https://www.linkedin.com/company/example-group',
        sourceUrl: `https://maps.example/${encodeURIComponent(`${niche} ${city}`)}`,
        sourceType: 'research_agent',
        source: 'scheduler_daily_discovery',
        fitScore: 'High',
      },
    ];

    await this.prisma.researchLead.createMany({
      data: leadsSeed.map((l) => ({ ...l, runId: run.id })),
    });

    let exported = 0;
    for (const l of leadsSeed) {
      try {
        await this.prisma.lead.create({
          data: {
            campaignId,
            businessName: l.companyName,
            niche,
            region: city,
            contactName: l.contactName,
            email: l.email,
            phone: l.phone,
            linkedinUrl: l.linkedinUrl,
            website: l.sourceUrl,
            source: l.sourceType,
            sourceDetail: l.source,
            fitScore: l.fitScore,
            status: 'NEW',
          },
        });
        exported += 1;
      } catch {}
    }

    await this.prisma.researchRun.update({
      where: { id: run.id },
      data: {
        status: 'complete',
        completedAt: new Date(),
        sourcesUsed: ['scheduler_daily_discovery'] as any,
        metadata: {
          source: 'scheduler',
          mode: 'daily_discovery',
          phase: 'Lead Discovery',
          progress: 100,
          counts: { leadsFound: leadsSeed.length, leadsExported: exported },
        } as any,
      },
    });

    await this.events.publish({
      eventType: 'research.daily_discovery.completed',
      campaignId,
      payload: { runId: run.id, leadsFound: leadsSeed.length, leadsExported: exported },
    });

    return { leads: exported, discovered: leadsSeed.length, runId: run.id };
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
        const type = String((job as any).jobType || '').toUpperCase();
        if (type === 'RESEARCH_RUN') return this.runLeadResearch(campaignId);
        if (type === 'EMAIL_BATCH') return this.runOutreachDrafting(campaignId);
        if (type === 'LINKEDIN_DM_BATCH') return this.runOutreachDrafting(campaignId);
        if (type === 'POST_LINKEDIN') return this.runContentDrafting(campaignId);
        if (type === 'POST_FACEBOOK') return this.runContentDrafting(campaignId);

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

  async runScheduledSocialPublishing(limit = 20) {
    const max = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const now = new Date();
    const due = await this.prisma.socialPost.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
      take: max,
    });

    const results: any[] = [];
    for (const post of due) {
      try {
        if (String(post.channel) === 'LINKEDIN') {
          const res = await fetch(`${process.env.PUBLIC_API_BASE || 'http://localhost:3001'}/api/linkedin/post`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-admin-token': process.env.ADMIN_TOKEN || 'change-me' },
            body: JSON.stringify({ socialPostId: post.id }),
          });
          if (!res.ok) throw new Error(`LinkedIn publish failed (${res.status})`);
        } else if (String(post.channel) === 'FACEBOOK') {
          const res = await fetch(`${process.env.PUBLIC_API_BASE || 'http://localhost:3001'}/api/facebook/publish`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-admin-token': process.env.ADMIN_TOKEN || 'change-me' },
            body: JSON.stringify({ socialPostId: post.id, mode: 'socialPost' }),
          });
          if (!res.ok) throw new Error(`Facebook publish failed (${res.status})`);
        } else {
          throw new Error(`Unsupported social channel: ${post.channel}`);
        }

        await this.prisma.auditLog.create({
          data: {
            actorType: 'system',
            action: 'scheduler.social_publish.sent',
            resourceType: 'social_post',
            resourceId: post.id,
            metadata: { channel: post.channel } as any,
          },
        });
        results.push({ id: post.id, status: 'posted' });
      } catch (e: any) {
        await this.prisma.auditLog.create({
          data: {
            actorType: 'system',
            action: 'scheduler.social_publish.failed',
            resourceType: 'social_post',
            resourceId: post.id,
            metadata: { channel: post.channel, error: String(e?.message || 'failed') } as any,
          },
        });
        results.push({ id: post.id, status: 'failed', error: String(e?.message || 'failed') });
      }
    }

    await this.events.publish({ eventType: 'scheduler.social_publish.completed', payload: { processed: results.length } });
    return { ok: true, processed: results.length, results };
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
          jobType: d.name.includes('Lead Research') ? 'RESEARCH_RUN' : d.name.includes('Outreach') ? 'EMAIL_BATCH' : d.name.includes('Content') ? 'POST_LINKEDIN' : 'EMAIL_BATCH',
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
