import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { UnsubscribeService } from '../unsubscribe/unsubscribe.service';
import { greetingNameFor } from './greeting';

/**
 * Follow-up sequence engine.
 *
 * followUpStage counts emails sent to the lead (sendApprovedEmail
 * increments it on every successful send):
 *   0  → nothing sent yet
 *   1  → first email sent;   follow-up 1 due 3 days later (day 3)  — gentle re-ping
 *   2  → follow-up 1 sent;   follow-up 2 due 4 days later (day 7)  — specific question
 *   3  → follow-up 2 sent;   follow-up 3 due 7 days later (day 14) — polite breakup
 *   4  → breakup sent; sequence completes
 *   99 → sequence stopped (replied, engaged, unsubscribed, completed, expired)
 *
 * This service finds leads whose next follow-up is due and generates a
 * draft into the approvals queue. Drafts are NEVER auto-sent — user
 * approves each one manually.
 */

// Gap in days after the Nth email before follow-up N is due.
const FOLLOWUP_DELAYS_DAYS = [3, 4, 7];
// A follow-up that's this many days overdue (e.g. the lead sat untouched
// for months) is dropped rather than sent — "following up on my email from
// May" reads as spam.
const STALE_GRACE_DAYS = 14;

const NO_INVENTED_STATS = `- The ONLY statistic you may cite is "most local businesses miss 30–60% of their calls". Never cite any other percentage, number of bookings, or figure (the $97/mo price is fine).`;

const FOLLOWUP_SYSTEM_PROMPTS: Record<number, string> = {
  1: `You write a gentle FOLLOW-UP email to a cold prospect who didn't reply to a first outreach message 3 days ago.
Rules:
- 2-3 sentences TOTAL
- Start with "Hi {firstName}," (or "Hi there," if unknown)
- Reference that you reached out recently — don't restate the whole pitch
- One short sentence about RevoAI's hook (missed calls / 24/7 answering / $97/mo)
- End with one soft question ("worth a quick look?" / "want me to send a 90-sec demo?")
- No CTA URL in a follow-up — keep it reply-friendly. End with a single "Thanks," and the sender first name
- Max ONE exclamation mark, zero banned phrases ("revolutionize", "game-changer", fake reviews, "no credit card required")
${NO_INVENTED_STATS}
- Output JSON: {"subject":"<Re: previous subject OR short 30-char follow-up>","body":"<email text>"}`,

  2: `You write a Day-7 follow-up email to a cold prospect still not replying. Take a different angle than the previous two messages.
Rules:
- 3-4 sentences TOTAL
- Start with "Hi {firstName},"
- Lead with a short, concrete observation about when calls get missed in their kind of business (e.g., for dental: "Calls that come in over lunch or after 5 usually go to voicemail, and most callers don't leave one.")
- One sentence tying it to RevoAI
- End with a low-commitment question ("Worth a 10-min call?" / "Want me to show you what your missed-calls number looks like?")
- No long URL, no pitch wall. Sign off "Thanks, {senderFirstName}"
- Max ONE exclamation. Zero banned phrases.
${NO_INVENTED_STATS}
- Output JSON: {"subject":"<Re: ... OR different short subject>","body":"<email text>"}`,

  3: `You write a FINAL "breakup" follow-up email to a cold prospect who has ignored three previous emails. Tone: polite, low-pressure, closes the loop.
Rules:
- 2-3 sentences TOTAL
- Start with "Hi {firstName},"
- Acknowledge this is the last message — something like "Not sure if now's the right time — I'll stop reaching out after this."
- One sentence keeping the door open ("If things change and 24/7 call coverage ever becomes a priority, I'm a reply away.")
- End "Thanks for your time. — {senderFirstName}"
- ZERO exclamation marks. Zero banned phrases.
${NO_INVENTED_STATS}
- Output JSON: {"subject":"<Re: ... OR 'Last note'>","body":"<email text>"}`,
};

@Injectable()
export class FollowUpService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('FollowUpService');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly unsubscribe: UnsubscribeService,
  ) {}

  onModuleInit() {
    // Auto-run cycle every 6 hours. Can be disabled by setting
    // FOLLOWUP_AUTOCRON=off in env.
    const autoCron = String(process.env.FOLLOWUP_AUTOCRON || 'on').toLowerCase();
    if (autoCron === 'off') {
      this.log.log('auto-cron disabled (FOLLOWUP_AUTOCRON=off)');
      return;
    }
    const intervalMs = 6 * 60 * 60 * 1000; // 6 hours
    // Wait 30s after boot before the first run so the app is stable
    setTimeout(() => this.safeRun(), 30_000);
    this.timer = setInterval(() => this.safeRun(), intervalMs);
    this.log.log(`follow-up auto-cron enabled — every ${intervalMs / 3600000}h`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async safeRun() {
    try {
      const out = await this.runCycle();
      this.log.log(`auto-cycle: processed=${out.processed} generated=${out.generated} errors=${out.errors.length}`);
    } catch (err: any) {
      this.log.error(`auto-cycle failed: ${err?.message || err}`);
    }
  }

  /**
   * Called by the scheduler. Finds leads whose next follow-up is due and
   * generates a draft for each. Returns a summary of what it did.
   */
  async runCycle(): Promise<{ processed: number; generated: number; errors: string[] }> {
    const errors: string[] = [];
    let generated = 0;
    const processed = await this.findLeadsDueForFollowUp();

    for (const { lead, action } of processed) {
      try {
        if (action !== 'draft') {
          await this.prisma.lead.update({
            where: { id: lead.id },
            data: { followUpStage: 99, sequencePausedReason: action },
          });
          continue;
        }

        // followUpStage = emails sent so far, so it's also the number of
        // the follow-up that's now due (1 = first follow-up).
        const nextStage = lead.followUpStage;
        const draftId = await this.generateFollowUpDraft(lead, nextStage);
        if (draftId) {
          generated += 1;
          // Note: we DO NOT advance followUpStage here — it advances when the
          // follow-up draft is actually sent (via sendApprovedEmail). That way
          // if the user deletes/rejects the draft, we can retry the same stage.
          await this.events.publish({
            eventType: 'lead.followup.generated',
            campaignId: lead.campaignId,
            payload: { leadId: lead.id, stage: nextStage, draftId },
          });
        }
      } catch (err: any) {
        errors.push(`lead ${lead.id}: ${err?.message || String(err)}`);
      }
    }

    return { processed: processed.length, generated, errors };
  }

  private async findLeadsDueForFollowUp(): Promise<Array<{ lead: any; action: 'draft' | 'completed' | 'expired' | 'unsubscribed' }>> {
    const now = new Date();
    const allActive = await this.prisma.lead.findMany({
      where: {
        followUpStage: { gte: 1, lt: 99 },
        lastOutboundAt: { not: null },
        email: { not: null },
        status: { notIn: ['REPLIED', 'BOOKED', 'LOST'] as any },
      },
      orderBy: { lastOutboundAt: 'asc' },
      take: 200,
    });

    const out: Array<{ lead: any; action: 'draft' | 'completed' | 'expired' | 'unsubscribed' }> = [];
    for (const l of allActive) {
      const sent = l.followUpStage;
      if (sent > FOLLOWUP_DELAYS_DAYS.length) {
        out.push({ lead: l, action: 'completed' });
        continue;
      }
      const daysSinceLast = (now.getTime() - (l.lastOutboundAt?.getTime() || 0)) / 86400000;
      const requiredDelay = FOLLOWUP_DELAYS_DAYS[sent - 1];
      if (daysSinceLast < requiredDelay) continue;

      // Stop on recorded engagement (reply / click)
      if (l.lastEngagementAt && (l.lastEngagementAt.getTime() > (l.lastOutboundAt?.getTime() || 0))) continue;

      if (l.email && (await this.unsubscribe.isSuppressed(l.email))) {
        out.push({ lead: l, action: 'unsubscribed' });
        continue;
      }
      if (daysSinceLast > requiredDelay + STALE_GRACE_DAYS) {
        out.push({ lead: l, action: 'expired' });
        continue;
      }
      out.push({ lead: l, action: 'draft' });
    }
    return out;
  }

  private async generateFollowUpDraft(lead: any, stage: number): Promise<string | null> {
    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (!apiKey) return null;

    const brand = await this.prisma.brandSettings.findUnique({ where: { id: 'default' } });
    const senderFirst = String(brand?.yourName || '').trim().split(/\s+/)[0] || 'Tony';

    // Check for duplicate — don't generate if there's already an unapproved follow-up draft
    const existing = await this.prisma.draft.findFirst({
      where: {
        leadId: lead.id,
        draftType: 'OUTREACH',
        status: { in: ['DRAFT', 'NEEDS_APPROVAL'] as any },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return null;

    const prevDraft = await this.prisma.draft.findFirst({
      where: { leadId: lead.id, status: 'APPROVED' as any, draftType: 'OUTREACH' },
      orderBy: { createdAt: 'desc' },
    });

    const firstName = greetingNameFor(lead.contactName);

    const userPrompt = [
      `Follow-up stage: ${stage} of ${FOLLOWUP_DELAYS_DAYS.length}`,
      `Business: ${lead.businessName}`,
      lead.niche ? `Niche: ${lead.niche}` : null,
      lead.region ? `Region: ${lead.region}` : null,
      firstName ? `First name: ${firstName}` : `First name: unknown (use "Hi there,")`,
      `Sender first name: ${senderFirst}`,
      prevDraft?.subject ? `Previous subject line: ${prevDraft.subject}` : null,
      prevDraft ? `Days since previous email: ${Math.round((Date.now() - (lead.lastOutboundAt?.getTime() || 0)) / 86400000)}` : null,
      '',
      'Write the follow-up. Output only JSON.',
    ].filter(Boolean).join('\n');

    const client = new Anthropic({ apiKey });
    const model = (process.env.ANTHROPIC_DRAFT_MODEL || process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5').trim();

    let content: string;
    let subject: string;
    try {
      const resp = await client.messages.create({
        model,
        max_tokens: 2000,
        output_config: { effort: 'low' },
        system: FOLLOWUP_SYSTEM_PROMPTS[stage],
        messages: [{ role: 'user', content: userPrompt }],
      });
      const raw = (resp.content || []).map((b: any) => (b.type === 'text' ? b.text : '')).join('').trim();
      const jsonText = raw.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(jsonText);
      if (!parsed?.subject || !parsed?.body) return null;
      subject = String(parsed.subject).slice(0, 70);
      content = String(parsed.body).trim();
      // Backstop for the no-invented-stats rule — skip this cycle and let
      // the next one regenerate rather than queue a made-up figure.
      const pct = content.match(/\d+\s*(?:[–-]\s*\d+\s*)?%/g) || [];
      if (pct.some((p) => !/^30\s*[–-]\s*60\s*%$/.test(p.trim()))) {
        console.warn(`[FollowUpService] dropped draft for lead ${lead.id}: invented statistic ${pct.join(', ')}`);
        return null;
      }
    } catch (err: any) {
      console.warn('[FollowUpService] LLM call failed:', err?.message || err);
      return null;
    }

    // Prefix subject with Re: if not already
    if (!/^re:/i.test(subject) && prevDraft?.subject) {
      subject = `Re: ${String(prevDraft.subject).replace(/^re:\s*/i, '')}`.slice(0, 70);
    }

    const draft = await this.prisma.draft.create({
      data: {
        campaignId: lead.campaignId,
        leadId: lead.id,
        channel: 'EMAIL' as any,
        draftType: 'OUTREACH',
        status: 'NEEDS_APPROVAL' as any,
        subject,
        content,
      } as any,
    });

    await this.prisma.draftVersion.create({
      data: {
        draftId: draft.id,
        versionNumber: 1,
        content,
        changeNote: `Auto-generated follow-up stage ${stage}`,
      },
    });

    return draft.id;
  }

  /**
   * Called after a send succeeds to advance the lead's sequence stage
   * and set the clock for the next follow-up window.
   */
  async markOutboundSent(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;
    const nextStage = Math.min((lead.followUpStage || 0) + 1, 99);
    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        followUpStage: nextStage,
        lastOutboundAt: new Date(),
      },
    });
  }

  /**
   * Called when engagement is detected (reply, open+click, unsubscribe).
   * Stops the sequence so no more follow-ups are generated.
   */
  async pauseSequence(leadId: string, reason: 'replied' | 'opened' | 'clicked' | 'unsubscribed' | 'manual') {
    const data: any = {
      followUpStage: 99,
      sequencePausedReason: reason,
      lastEngagementAt: new Date(),
    };
    // Only reason=replied represents actual conversation — bump lead status
    // so the funnel / analytics / /leads filter reflect it. Opens and
    // clicks are engagement signals but not a reply.
    if (reason === 'replied') data.status = 'REPLIED';
    if (reason === 'unsubscribed') data.status = 'LOST';
    await this.prisma.lead.update({ where: { id: leadId }, data });
    await this.events.publish({ eventType: 'lead.sequence.paused', payload: { leadId, reason } });
  }
}
