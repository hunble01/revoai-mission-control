import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { ResearchService } from '../research/research.service';
import { LeadsService } from '../leads/leads.service';

/**
 * One-button autonomous campaign runner.
 *
 * runFull(campaignId) chains the whole outbound pipeline in the background:
 *   1. Research — Google Maps Places API discovery (existing logic)
 *   2. Promote discovered leads into the Lead table
 *   3. Enrich each new lead (LLM reads their website, extracts owner/services/pain)
 *   4. Generate a personalized draft for each (Claude Haiku)
 *
 * All progress events stream into /feed. Drafts land in /approvals.
 * The user approves + sends.
 *
 * Safe to fire and forget from the HTTP handler — returns immediately with
 * a correlation ID, the actual work continues in the background.
 */

type RunOptions = {
  query?: string;
  maxLeads?: number;     // hard cap to protect token + API budget
  enrichLimit?: number;  // max leads to LLM-enrich (only those with websites)
};

type RunSummary = {
  runId: string;
  discovered: number;
  promoted: number;
  enriched: number;
  drafted: number;
  errors: string[];
};

@Injectable()
export class CampaignAutorunService {
  private readonly log = new Logger('CampaignAutorun');
  // Track in-flight runs in memory for status polling
  private active = new Map<string, { startedAt: Date; campaignId: string; status: 'running' | 'complete' | 'error'; summary?: RunSummary; error?: string }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly research: ResearchService,
    private readonly leads: LeadsService,
  ) {}

  /** Fire and forget — returns correlation ID immediately, work continues async. */
  startFullRun(campaignId: string, opts: RunOptions = {}): string {
    const runId = `autorun_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.active.set(runId, { startedAt: new Date(), campaignId, status: 'running' });
    // Don't await — fire async
    this.runFullInternal(runId, campaignId, opts).catch((err) => {
      this.log.error(`autorun ${runId} failed: ${err?.message || err}`);
      const state = this.active.get(runId);
      if (state) {
        state.status = 'error';
        state.error = String(err?.message || err);
      }
    });
    return runId;
  }

  getStatus(runId: string) {
    return this.active.get(runId) || null;
  }

  private async runFullInternal(runId: string, campaignId: string, opts: RunOptions): Promise<RunSummary> {
    const summary: RunSummary = { runId, discovered: 0, promoted: 0, enriched: 0, drafted: 0, errors: [] };
    const maxLeads = opts.maxLeads ?? 40;
    const enrichLimit = opts.enrichLimit ?? 25;
    const enrichConcurrency = 3;
    const draftConcurrency = 3;

    const publish = (type: string, payload: any) =>
      this.events.publish({ eventType: `autorun.${type}`, campaignId, payload: { runId, ...payload } });

    await publish('started', { at: new Date().toISOString() });

    // ---- Stage 1: research via Google Maps ----
    let researchOut: any = null;
    try {
      researchOut = await this.research.run({ campaignId, requestedBy: 'autorun' });
      const discoveredCount = Number(researchOut?.metadata?.counts?.leads || 0);
      summary.discovered = discoveredCount;
      await publish('stage1.research', { discovered: discoveredCount });
    } catch (err: any) {
      summary.errors.push(`research: ${err?.message || err}`);
      await publish('error', { stage: 'research', message: String(err?.message || err) });
      this.markComplete(runId, summary, 'error');
      return summary;
    }

    // ---- Stage 2: promote discovered leads to real Leads ----
    let promotedLeads: any[] = [];
    try {
      const sourceRunId = researchOut?.id;
      if (!sourceRunId) throw new Error('research run did not return an id');
      const promotion = await this.research.promoteLeads(sourceRunId, { action: 'APPROVE', campaignId });
      summary.promoted = promotion?.promoted || 0;
      // Fetch the promoted Leads — they're the most recent in this campaign
      if (summary.promoted > 0) {
        promotedLeads = await this.prisma.lead.findMany({
          where: { campaignId, status: { in: ['APPROVED', 'NEW', 'RESEARCHED'] as any } },
          orderBy: { createdAt: 'desc' },
          take: Math.min(maxLeads, summary.promoted),
        });
      }
      await publish('stage2.promote', { promoted: summary.promoted });
    } catch (err: any) {
      summary.errors.push(`promote: ${err?.message || err}`);
      await publish('error', { stage: 'promote', message: String(err?.message || err) });
    }

    // ---- Stage 3: enrich each with website data (parallel, rate-limited) ----
    const enrichable = promotedLeads.filter((l) => l.website).slice(0, enrichLimit);
    if (enrichable.length) {
      await this.runInBatches(enrichable, enrichConcurrency, async (lead) => {
        try {
          await this.leads.enrichLead(lead.id);
          summary.enriched += 1;
        } catch (err: any) {
          summary.errors.push(`enrich ${lead.id}: ${err?.message || err}`);
        }
      });
    }
    await publish('stage3.enrich', { enriched: summary.enriched, skippedNoWebsite: promotedLeads.length - enrichable.length });

    // ---- Stage 4: generate drafts for every lead that has an email ----
    // (after enrichment, many more will have emails)
    const refreshed = await this.prisma.lead.findMany({
      where: { id: { in: promotedLeads.map((l) => l.id) } },
    });
    const draftable = refreshed.filter((l) => l.email && l.email.includes('@'));

    if (draftable.length) {
      await this.runInBatches(draftable, draftConcurrency, async (lead) => {
        try {
          // Skip if this lead already has a pending draft
          const existing = await this.prisma.draft.findFirst({
            where: {
              leadId: lead.id,
              status: { in: ['DRAFT', 'NEEDS_APPROVAL', 'APPROVED'] as any },
            },
          });
          if (existing) return;
          await this.leads.generateDraftForLead(lead.id, {}, 'autorun');
          summary.drafted += 1;
        } catch (err: any) {
          summary.errors.push(`draft ${lead.id}: ${err?.message || err}`);
        }
      });
    }
    await publish('stage4.draft', {
      drafted: summary.drafted,
      skippedNoEmail: refreshed.length - draftable.length,
    });

    await publish('complete', {
      discovered: summary.discovered,
      promoted: summary.promoted,
      enriched: summary.enriched,
      drafted: summary.drafted,
      errorCount: summary.errors.length,
    });

    this.markComplete(runId, summary, 'complete');
    return summary;
  }

  private markComplete(runId: string, summary: RunSummary, status: 'complete' | 'error') {
    const state = this.active.get(runId);
    if (state) {
      state.status = status;
      state.summary = summary;
    }
    // Clean up after 30 minutes so the map doesn't grow unbounded
    setTimeout(() => this.active.delete(runId), 30 * 60 * 1000);
  }

  /** Run an async operation over a list with limited concurrency. */
  private async runInBatches<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
    const queue = [...items];
    const workers: Promise<void>[] = [];
    for (let i = 0; i < concurrency; i += 1) {
      workers.push((async () => {
        while (queue.length) {
          const next = queue.shift();
          if (!next) break;
          await fn(next);
        }
      })());
    }
    await Promise.all(workers);
  }
}
