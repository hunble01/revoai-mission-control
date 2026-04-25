import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SocialAutopilotService } from './social-autopilot.service';

/**
 * Social autopilot cron — 6th system cron.
 *
 * Ticks every hour. Each tick: if config.enabled and we haven't yet hit the
 * daily cap, generate one autopilot post (RevoAI product or trend, with
 * auto-image, scheduled into the next bestTime window, saved as a draft for
 * Michael to approve in /today).
 *
 * Env controls:
 *   SOCIAL_AUTOPILOT_CRON=off            — disable entirely
 *   SOCIAL_AUTOPILOT_INTERVAL_MS         — tick interval (default 3,600,000 = 1h)
 */
@Injectable()
export class SocialAutopilotCronService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('SocialAutopilotCron');
  private timer?: NodeJS.Timeout;

  constructor(private readonly svc: SocialAutopilotService) {}

  onModuleInit() {
    const enabled = String(process.env.SOCIAL_AUTOPILOT_CRON || 'on').toLowerCase();
    if (enabled === 'off') {
      this.log.log('disabled (SOCIAL_AUTOPILOT_CRON=off)');
      return;
    }
    const intervalMs = Number(process.env.SOCIAL_AUTOPILOT_INTERVAL_MS || 3_600_000);
    setTimeout(() => this.safeTick(), 90_000);
    this.timer = setInterval(() => this.safeTick(), intervalMs);
    this.log.log(`enabled — ticking every ${(intervalMs / 60_000).toFixed(0)}m`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async safeTick() {
    try {
      const config = await this.svc.getConfig();
      if (!config.enabled) return;

      // Pace ourselves: don't run more than once per (24h / postsPerDay) interval.
      const minGapMs = (24 * 3_600_000) / Math.max(1, config.postsPerDay);
      if (config.lastRunAt) {
        const since = Date.now() - new Date(config.lastRunAt).getTime();
        if (since < minGapMs * 0.95) return; // small jitter buffer
      }

      const result = await this.svc.runOnce('cron');
      if (result?.ok) {
        this.log.log(`drafted: platform=${result.platform} mix=${result.mix} angle=${result.angle}`);
      } else if (result?.skipped) {
        // expected — cap reached or disabled mid-run
      } else if (result?.error) {
        this.log.warn(`tick error: ${result.error}`);
      }
    } catch (err: any) {
      this.log.error(`tick failed: ${err?.message || err}`);
    }
  }
}
