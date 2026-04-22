import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

/**
 * Follow-up sequence engine.
 *
 * Each lead moves through stages based on days since last outbound:
 *   0  → initial cold email sent; wait 3 days
 *   1  → Day 3 — gentle re-ping (2-3 sentences)
 *   2  → Day 7 — curiosity / specific question (3-4 sentences)
 *   3  → Day 14 — polite breakup (2-3 sentences, removes pressure)
 *   99 → sequence stopped (replied, engaged, unsubscribed, or completed)
 *
 * This service finds leads whose next follow-up is due and generates a
 * draft into the approvals queue. Drafts are NEVER auto-sent — user
 * approves each one manually.
 */

const FOLLOWUP_DELAYS_DAYS = [3, 7, 14]; // stage N+1 fires this many days after stage N sent

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
- Output JSON: {"subject":"<Re: previous subject OR short 30-char follow-up>","body":"<email text>"}`,

  2: `You write a Day-7 follow-up email to a cold prospect still not replying. Take a different angle than the previous two messages.
Rules:
- 3-4 sentences TOTAL
- Start with "Hi {firstName},"
- Lead with a CONCRETE pain stat or short observation specific to their industry (e.g., for dental: "70% of missed calls come during lunch and after hours. For a busy clinic, that's 20+ bookings a week."). Don't invent numbers not commonly cited.
- One sentence tying it to RevoAI
- End with a low-commitment question ("Worth a 10-min call?" / "Want me to show you what your missed-calls number looks like?")
- No long URL, no pitch wall. Sign off "Thanks, {senderFirstName}"
- Max ONE exclamation. Zero banned phrases.
- Output JSON: {"subject":"<Re: ... OR different short subject>","body":"<email text>"}`,

  3: `You write a FINAL "breakup" follow-up email to a cold prospect who has ignored three previous emails. Tone: polite, low-pressure, closes the loop.
Rules:
- 2-3 sentences TOTAL
- Start with "Hi {firstName},"
- Acknowledge this is the last message — something like "Not sure if now's the right time — I'll stop reaching out after this."
- One sentence keeping the door open ("If things change and 24/7 call coverage ever becomes a priority, I'm a reply away.")
- End "Thanks for your time. — {senderFirstName}"
- ZERO exclamation marks. Zero banned phrases.
- Output JSON: {"subject":"<Re: ... OR 'Last note'>","body":"<email text>"}`,
};

@Injectable()
export class FollowUpService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('FollowUpService');
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

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

    for (const lead of processed) {
      try {
        const nextStage = (lead.followUpStage || 0) + 1;
        if (nextStage > FOLLOWUP_DELAYS_DAYS.length) {
          // Exhausted the sequence
          await this.prisma.lead.update({
            where: { id: lead.id },
            data: { followUpStage: 99, sequencePausedReason: 'completed' },
          });
          continue;
        }

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

  private async findLeadsDueForFollowUp() {
    const now = new Date();
    const allActive = await this.prisma.lead.findMany({
      where: {
        followUpStage: { lt: 99 },
        lastOutboundAt: { not: null },
        email: { not: null },
      },
      orderBy: { lastOutboundAt: 'asc' },
      take: 200,
    });

    return allActive.filter((l) => {
      const stage = l.followUpStage || 0;
      if (stage >= FOLLOWUP_DELAYS_DAYS.length) return false;
      const daysSinceLast = (now.getTime() - (l.lastOutboundAt?.getTime() || 0)) / 86400000;
      const requiredDelay = FOLLOWUP_DELAYS_DAYS[stage];
      if (daysSinceLast < requiredDelay) return false;

      // Don't follow up if we see any engagement recorded
      if (l.lastEngagementAt && (l.lastEngagementAt.getTime() > (l.lastOutboundAt?.getTime() || 0))) {
        return false;
      }

      // Don't follow up if there's already an open DRAFT or NEEDS_APPROVAL draft
      return true;
    });
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

    const firstName = (() => {
      const parts = String(lead.contactName || '').trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return '';
      if (/^(Dr|Mr|Mrs|Ms|Mx|Prof)\.?$/i.test(parts[0])) return parts[1] || parts[0];
      return parts[0];
    })();

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
    const model = (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim();

    let content: string;
    let subject: string;
    try {
      const resp = await client.messages.create({
        model,
        max_tokens: 500,
        system: FOLLOWUP_SYSTEM_PROMPTS[stage],
        messages: [{ role: 'user', content: userPrompt }],
      });
      const raw = (resp.content || []).map((b: any) => (b.type === 'text' ? b.text : '')).join('').trim();
      const jsonText = raw.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(jsonText);
      if (!parsed?.subject || !parsed?.body) return null;
      subject = String(parsed.subject).slice(0, 70);
      content = String(parsed.body).trim();
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
