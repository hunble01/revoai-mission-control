import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { CampaignAutorunService } from './campaign-autorun.service';

/**
 * Scheduled autorun — fires the autorun pipeline automatically for any
 * campaign whose `scheduledAutorunAt` has passed. Runs a small cron on
 * server start; ticks every 15 min by default.
 *
 * Why: Michael's 2-week outreach plan has one campaign scheduled per
 * weekday. Manually clicking ⚡ Run Campaign every morning is friction
 * he shouldn't have. Instead, each campaign gets a `scheduledAutorunAt`
 * timestamp; this service notices, fires, and clears the field.
 *
 * Safety:
 *  - Skips if a research_run already exists for this campaign today
 *    (prevents double-fire if user also clicks manually on the same day)
 *  - Skips if the campaign's status is not 'active'
 *  - Clears scheduledAutorunAt immediately after firing so a crash on the
 *    autorun side won't cause a re-fire loop
 *  - Env disable: SCHEDULED_AUTORUN=off
 */
@Injectable()
export class ScheduledAutorunService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('ScheduledAutorun');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly autorun: CampaignAutorunService,
  ) {}

  onModuleInit() {
    const enabled = String(process.env.SCHEDULED_AUTORUN || 'on').toLowerCase();
    if (enabled === 'off') {
      this.log.log('disabled (SCHEDULED_AUTORUN=off)');
      return;
    }
    const intervalMs = Number(process.env.SCHEDULED_AUTORUN_INTERVAL_MS || 15 * 60 * 1000);
    // First tick 45s after boot so app is stable
    setTimeout(() => this.safeTick(), 45_000);
    this.timer = setInterval(() => this.safeTick(), intervalMs);
    this.log.log(`enabled — ticking every ${(intervalMs / 60000).toFixed(0)}m`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async safeTick() {
    try {
      const fired = await this.runCycle();
      if (fired.length) {
        this.log.log(`fired ${fired.length} scheduled autoruns: ${fired.map((f) => f.name).join(', ')}`);
      }
    } catch (err: any) {
      this.log.error(`tick failed: ${err?.message || err}`);
    }
  }

  /** One pass. Returns the campaigns we actually fired. */
  async runCycle(): Promise<Array<{ id: string; name: string; runId: string }>> {
    const now = new Date();
    const due = await this.prisma.campaign.findMany({
      where: {
        scheduledAutorunAt: { lte: now, not: null },
        status: 'active',
      },
      select: { id: true, name: true, scheduledAutorunAt: true },
      orderBy: { scheduledAutorunAt: 'asc' },
    });
    if (!due.length) return [];

    const fired: Array<{ id: string; name: string; runId: string }> = [];
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    for (const c of due) {
      // Skip if something already ran this campaign today
      const existingRun = await this.prisma.researchRun.findFirst({
        where: { campaignId: c.id, createdAt: { gte: startOfDay } },
        select: { id: true },
      });
      if (existingRun) {
        // Clear the scheduled time so we don't keep re-evaluating each tick
        await this.prisma.campaign.update({
          where: { id: c.id },
          data: { scheduledAutorunAt: null },
        });
        this.log.log(`skip ${c.name} — already ran today (research run ${existingRun.id.slice(0, 8)})`);
        continue;
      }

      // Clear the schedule first so a crash in autorun doesn't cause a refire loop
      await this.prisma.campaign.update({
        where: { id: c.id },
        data: { scheduledAutorunAt: null },
      });

      const runId = this.autorun.startFullRun(c.id, { maxLeads: 40, enrichLimit: 20 });
      fired.push({ id: c.id, name: c.name, runId });

      await this.events.publish({
        eventType: 'autorun.scheduled.fired',
        campaignId: c.id,
        payload: { campaignName: c.name, runId, scheduledFor: c.scheduledAutorunAt },
      });
    }
    return fired;
  }
}
