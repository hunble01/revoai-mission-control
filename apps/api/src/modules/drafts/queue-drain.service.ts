import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DraftsService } from './drafts.service';

/**
 * Outbound queue drain cron.
 *
 * When a user clicks "Approve & Queue" in /approvals, a draft moves to
 * APPROVED status and a corresponding OutboundQueue row gets created
 * with status=QUEUED. Without this service, that row would sit there
 * forever — the actual send only happened when someone POSTed to
 * /api/drafts/queue/process manually.
 *
 * This cron calls processQueuedOutbound every minute, respecting
 * daily-send caps (enforced inside the send path) and channel mix.
 *
 * Env controls:
 *   QUEUE_DRAIN=off                — disable entirely
 *   QUEUE_DRAIN_INTERVAL_MS=60000  — how often to tick (default 1 min)
 *   QUEUE_DRAIN_BATCH=10           — max items per tick
 */
@Injectable()
export class QueueDrainService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('QueueDrain');
  private timer?: NodeJS.Timeout;

  constructor(private readonly drafts: DraftsService) {}

  onModuleInit() {
    const enabled = String(process.env.QUEUE_DRAIN || 'on').toLowerCase();
    if (enabled === 'off') {
      this.log.log('disabled (QUEUE_DRAIN=off)');
      return;
    }
    const intervalMs = Number(process.env.QUEUE_DRAIN_INTERVAL_MS || 60_000);
    // First tick 30s after boot so other services settle
    setTimeout(() => this.safeTick(), 30_000);
    this.timer = setInterval(() => this.safeTick(), intervalMs);
    this.log.log(`enabled — ticking every ${(intervalMs / 1000).toFixed(0)}s`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async safeTick() {
    try {
      const limit = Number(process.env.QUEUE_DRAIN_BATCH || 10);
      const results = await this.drafts.processQueuedOutbound(limit);
      const sent = Array.isArray(results) ? results.filter((r: any) => r.status === 'sent').length : 0;
      const failed = Array.isArray(results) ? results.filter((r: any) => r.status !== 'sent').length : 0;
      if (sent > 0 || failed > 0) {
        this.log.log(`drained: sent=${sent} failed=${failed}`);
      }
    } catch (err: any) {
      this.log.error(`tick failed: ${err?.message || err}`);
    }
  }
}
