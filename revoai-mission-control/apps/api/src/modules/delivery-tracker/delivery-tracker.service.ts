import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { UnsubscribeService } from '../unsubscribe/unsubscribe.service';
import { FollowUpService } from '../leads/followup.service';

type ResendEventStatus = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed' | 'delivery_delayed';

/**
 * Polls Resend's GET /emails/{id} for every sent-in-the-last-7-days message
 * and updates OutboundSend + Lead + suppression list based on the latest
 * event Resend has for that message.
 *
 * Why polling vs webhooks:
 *   Webhooks need an HTTPS endpoint. app.revoai.info HTTPS cutover is
 *   deferred until the app is feature-complete. Polling works today with
 *   the infrastructure we have. Latency is ~interval/2 on average, which
 *   is fine for the use cases here (auto-suppress bounces, pause
 *   sequences on engagement, update status for reporting).
 *
 * Behavior per last_event:
 *   delivered  — update status, no side effects
 *   opened     — update status + lead.lastEngagementAt (don't pause seq)
 *   clicked    — update status + lead.lastEngagementAt + pause sequence
 *   bounced    — update status + add recipient to suppression list
 *   complained — update status + add recipient to suppression list
 *   failed     — update status
 *
 * Stops polling once status reaches a terminal state (bounced /
 * complained / failed) or once sentAt is older than 7 days.
 */
@Injectable()
export class DeliveryTrackerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('DeliveryTracker');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly unsubscribe: UnsubscribeService,
    private readonly followup: FollowUpService,
  ) {}

  onModuleInit() {
    const autoCron = String(process.env.DELIVERY_TRACKER_AUTOCRON || 'on').toLowerCase();
    if (autoCron === 'off') {
      this.log.log('auto-cron disabled (DELIVERY_TRACKER_AUTOCRON=off)');
      return;
    }
    const intervalMs = Number(process.env.DELIVERY_TRACKER_INTERVAL_MS || 30 * 60 * 1000); // 30 min default
    // First tick 60s after boot so the app is stable
    setTimeout(() => this.safeTick(), 60_000);
    this.timer = setInterval(() => this.safeTick(), intervalMs);
    this.log.log(`delivery-tracker auto-cron enabled — every ${(intervalMs / 60000).toFixed(0)}m`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async safeTick() {
    try {
      const summary = await this.runCycle();
      this.log.log(`tick: polled=${summary.polled} updated=${summary.updated} suppressed=${summary.suppressed} paused=${summary.paused} errors=${summary.errors}`);
    } catch (err: any) {
      this.log.error(`tick failed: ${err?.message || err}`);
    }
  }

  /** One pass over all in-flight sends. Returns a summary. */
  async runCycle() {
    const apiKey = (process.env.EMAIL_SMTP_PASS || process.env.RESEND_API_KEY || '').trim();
    const summary = { polled: 0, updated: 0, suppressed: 0, paused: 0, errors: 0 };
    if (!apiKey) {
      this.log.warn('no Resend API key; skipping tick');
      return summary;
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const candidates = await this.prisma.outboundSend.findMany({
      where: {
        provider: 'EMAIL',
        externalMessageId: { not: null },
        sentAt: { gte: sevenDaysAgo },
        // terminal states — stop polling
        status: { notIn: ['bounced', 'complained', 'failed'] },
      },
      take: 300,
      orderBy: { sentAt: 'desc' },
    });

    for (const row of candidates) {
      summary.polled += 1;
      try {
        const raw = row.externalMessageId || '';
        // If the message ID has an @ and angle brackets, it's an SMTP
        // Message-ID — Resend's REST API can't look those up (404). Skip
        // silently. (New sends via the Resend REST path have plain UUID.)
        const isSmtpLegacy = /^<.*@.*>$/.test(raw);
        const mid = this.stripMessageId(raw);
        if (!mid) continue;
        if (isSmtpLegacy) {
          // One-time cleanup: null out so we stop polling this forever.
          await this.prisma.outboundSend.update({
            where: { id: row.id },
            data: { externalMessageId: null },
          });
          continue;
        }
        const resp = await fetch(`https://api.resend.com/emails/${encodeURIComponent(mid)}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!resp.ok) {
          if (resp.status === 404) {
            // Message isn't in Resend — either SMTP-sent (see above), retention window,
            // or it's very fresh and not yet visible. Don't count as error.
            continue;
          }
          summary.errors += 1;
          continue;
        }
        const body: any = await resp.json().catch(() => ({}));
        const event = String(body?.last_event || '').toLowerCase() as ResendEventStatus;
        if (!event || event === 'sent') continue;

        const previousStatus = row.status;
        const nextStatus = this.mapEventToStatus(event);
        if (nextStatus === previousStatus) continue;

        await this.prisma.outboundSend.update({
          where: { id: row.id },
          data: { status: nextStatus },
        });
        summary.updated += 1;

        // Side effects based on the new terminal/engagement event
        if (event === 'bounced' || event === 'complained') {
          const recipient = Array.isArray(body?.to) ? body.to[0] : body?.to;
          if (recipient) {
            await this.unsubscribe.suppress(
              recipient,
              event.toUpperCase(),
              'resend-polling',
              `Auto-suppressed on ${event} event for send ${mid}`,
            );
            summary.suppressed += 1;
          }
        } else if (event === 'opened' || event === 'clicked') {
          if (row.leadId) {
            await this.prisma.lead.update({
              where: { id: row.leadId },
              data: { lastEngagementAt: new Date() },
            });
            // Clicked is strong intent — pause the sequence so we stop
            // hammering them. Opened is soft signal; don't pause.
            if (event === 'clicked') {
              await this.followup.pauseSequence(row.leadId, 'clicked');
              summary.paused += 1;
            }
          }
        }

        await this.events.publish({
          eventType: `delivery.${event}`,
          payload: {
            outboundSendId: row.id,
            leadId: row.leadId,
            messageId: mid,
            fromStatus: previousStatus,
            toStatus: nextStatus,
          },
        });
      } catch (err: any) {
        summary.errors += 1;
        this.log.warn(`poll error for send ${row.id}: ${err?.message || err}`);
      }
    }

    return summary;
  }

  /** Strip the surrounding <...@outreach.revoai.ca> wrapper that SMTP adds. */
  private stripMessageId(raw: string): string {
    const trimmed = String(raw || '').trim();
    // If it's already a UUID-ish message ID from the REST API, keep as-is
    if (/^[0-9a-f-]{36}$/i.test(trimmed)) return trimmed;
    // SMTP returns '<uuid@domain>' — extract just the uuid part
    const m = trimmed.match(/<([^@>]+)(?:@[^>]*)?>/);
    return m ? m[1] : trimmed;
  }

  private mapEventToStatus(event: string): string {
    switch (event) {
      case 'delivered': return 'delivered';
      case 'opened': return 'opened';
      case 'clicked': return 'clicked';
      case 'bounced': return 'bounced';
      case 'complained': return 'complained';
      case 'failed': return 'failed';
      case 'delivery_delayed': return 'sent'; // treat as still-in-flight
      default: return 'sent';
    }
  }
}
