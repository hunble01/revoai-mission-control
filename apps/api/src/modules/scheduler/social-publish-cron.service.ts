import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

/**
 * Social-post auto-publish cron.
 *
 * SchedulerService.runScheduledSocialPublishing() finds due SocialPost rows
 * (status='scheduled' AND scheduledAt <= now) and dispatches them to the
 * right platform's publish endpoint. Without this cron, due posts never
 * fire on their own — someone has to POST /scheduler/social-publish/run-now
 * manually. The /social hub UI lets you schedule for future times, so we
 * need a tick.
 *
 * Env controls:
 *   SOCIAL_PUBLISH_CRON=off            — disable entirely
 *   SOCIAL_PUBLISH_CRON_INTERVAL_MS    — tick interval (default 60s)
 *   SOCIAL_PUBLISH_CRON_BATCH          — max posts per tick (default 20)
 */
@Injectable()
export class SocialPublishCronService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('SocialPublishCron');
  private timer?: NodeJS.Timeout;

  constructor(private readonly scheduler: SchedulerService) {}

  onModuleInit() {
    const enabled = String(process.env.SOCIAL_PUBLISH_CRON || 'on').toLowerCase();
    if (enabled === 'off') {
      this.log.log('disabled (SOCIAL_PUBLISH_CRON=off)');
      return;
    }
    const intervalMs = Number(process.env.SOCIAL_PUBLISH_CRON_INTERVAL_MS || 60_000);
    setTimeout(() => this.safeTick(), 45_000);
    this.timer = setInterval(() => this.safeTick(), intervalMs);
    this.log.log(`enabled — ticking every ${(intervalMs / 1000).toFixed(0)}s`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async safeTick() {
    try {
      const limit = Number(process.env.SOCIAL_PUBLISH_CRON_BATCH || 20);
      const results = await this.scheduler.runScheduledSocialPublishing(limit);
      const arr = Array.isArray(results) ? results : (results as any)?.results || [];
      const sent = arr.filter((r: any) => r.status === 'posted').length;
      const failed = arr.filter((r: any) => r.status === 'failed').length;
      if (sent > 0 || failed > 0) {
        this.log.log(`published: posted=${sent} failed=${failed}`);
      }
    } catch (err: any) {
      this.log.error(`tick failed: ${err?.message || err}`);
    }
  }
}
