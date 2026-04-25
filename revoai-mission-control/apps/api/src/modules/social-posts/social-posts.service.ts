import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class SocialPostsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  list(status?: string) {
    return this.prisma.socialPost.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  create(body: any) {
    const platform = String(body?.platform || body?.channel || 'LINKEDIN').toUpperCase();
    const content = String(body?.content || body?.body || '').trim();
    const hashtags = Array.isArray(body?.hashtags) ? body.hashtags : [];
    return this.prisma.socialPost.create({
      data: {
        channel: (platform === 'BOTH' ? 'LINKEDIN' : platform) as any,
        body: content,
        mediaUrl: body?.mediaUrl || null,
        scheduledAt: body?.scheduledAt ? new Date(body.scheduledAt) : null,
        status: body?.status || 'draft',
        sourceType: body?.sourceType || 'manual',
        groupId: body?.groupId || null,
        engagementStats: { hashtags, requestedPlatform: platform } as any,
      } as any,
    });
  }

  /**
   * Fan-out helper: a single Compose action that targets multiple platforms.
   * Each platform gets its own SocialPost row, all sharing a `groupId`.
   * The /social Queue + Calendar use `groupId` to render the bundle as one row.
   */
  async bulkCreate(body: any) {
    const channels: string[] = Array.isArray(body?.channels)
      ? body.channels.map((c: any) => String(c || '').toUpperCase()).filter((c: string) => ['LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE'].includes(c))
      : [];
    if (channels.length === 0) throw new BadRequestException('At least one channel required');

    const content = String(body?.content || body?.body || '').trim();
    if (!content) throw new BadRequestException('Post body required');

    const status = String(body?.status || (body?.scheduledAt ? 'scheduled' : 'draft'));
    const scheduledAt = body?.scheduledAt ? new Date(body.scheduledAt) : null;
    const hashtags = Array.isArray(body?.hashtags) ? body.hashtags : [];
    const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const created: any[] = [];
    for (const ch of channels) {
      // YouTube has no auto-publish in Wave 1 — keep as 'draft' regardless of requested status
      const effectiveStatus = ch === 'YOUTUBE' ? 'draft' : status;
      const row = await this.prisma.socialPost.create({
        data: {
          channel: ch as any,
          body: content,
          mediaUrl: body?.mediaUrl || null,
          scheduledAt: ch === 'YOUTUBE' ? null : scheduledAt,
          status: effectiveStatus,
          sourceType: body?.sourceType || 'manual',
          groupId,
          engagementStats: { hashtags, requestedPlatform: ch } as any,
        } as any,
      });
      created.push(row);
    }

    await this.events.publish({
      eventType: 'POST_DRAFT_CREATED',
      payload: { groupId, channels, count: created.length, scheduled: !!scheduledAt },
    });

    return { ok: true, groupId, posts: created };
  }

  /**
   * Brand-voice lint. Non-blocking: returns a list of issues so the UI can
   * warn the user before publish. Reuses the rule list from REVOAI brand
   * voice in REVOAI_PRODUCT_CONTEXT.md.
   */
  validateBrandVoice(body: string): Array<{ rule: string; severity: 'warn' | 'info'; message: string }> {
    const issues: Array<{ rule: string; severity: 'warn' | 'info'; message: string }> = [];
    const text = String(body || '');
    const lower = text.toLowerCase();

    const banned = ['revolutionize', 'game-changer', 'in today\'s fast-paced world', 'synergy', 'seamless', 'best-in-class', 'cutting-edge'];
    for (const word of banned) {
      if (lower.includes(word.toLowerCase())) {
        issues.push({ rule: 'banned_phrase', severity: 'warn', message: `Avoid "${word}" — sounds like marketing-team copy.` });
      }
    }

    const exclamations = (text.match(/!/g) || []).length;
    if (exclamations > 1) {
      issues.push({ rule: 'too_many_exclamations', severity: 'warn', message: `${exclamations} exclamation marks. Cap at 1 per post.` });
    }

    const emDashes = (text.match(/—/g) || []).length;
    if (emDashes > 0) {
      issues.push({ rule: 'em_dash', severity: 'warn', message: `Em-dash detected. Use a period or comma instead.` });
    }

    const allCapsLines = text.split('\n').filter((l) => l.length > 5 && l === l.toUpperCase() && /[A-Z]/.test(l));
    if (allCapsLines.length > 0) {
      issues.push({ rule: 'all_caps', severity: 'warn', message: 'ALL-CAPS line detected. Reads like spam.' });
    }

    if (lower.includes('no credit card required')) {
      issues.push({ rule: 'inaccurate_claim', severity: 'warn', message: '"No credit card required" is not accurate — RevoAI requires a card on signup.' });
    }

    return issues;
  }

  async update(id: string, body: any) {
    const existing = await this.prisma.socialPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Social post not found');
    return this.prisma.socialPost.update({
      where: { id },
      data: {
        body: body?.body ?? existing.body,
        mediaUrl: body?.mediaUrl ?? existing.mediaUrl,
        status: body?.status ?? existing.status,
        scheduledAt: body?.scheduledAt ? new Date(body.scheduledAt) : existing.scheduledAt,
      },
    });
  }

  async transition(id: string, status: 'approved' | 'scheduled' | 'posted' | 'draft', notes?: string, scheduledAt?: string, externalPostId?: string) {
    const existing = await this.prisma.socialPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Social post not found');

    const current = String(existing.status || '').toLowerCase();
    if (status === 'approved' && !['draft', 'needs_approval'].includes(current)) {
      throw new BadRequestException('Only draft/needs_approval posts can be approved');
    }
    if (status === 'scheduled' && current !== 'approved') {
      throw new BadRequestException('Only approved posts can be scheduled');
    }
    if (status === 'posted' && !['approved', 'scheduled'].includes(current)) {
      throw new BadRequestException('Only approved/scheduled posts can be posted');
    }

    const updated = await this.prisma.socialPost.update({
      where: { id },
      data: {
        status,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : existing.scheduledAt,
        postedAt: status === 'posted' ? new Date() : existing.postedAt,
        externalPostId: externalPostId || existing.externalPostId,
      },
    });

    await this.events.publish({
      eventType: status === 'posted' ? 'POST_PUBLISHED' : 'POST_DRAFT_CREATED',
      payload: { socialPostId: updated.id, status, notes: notes || null },
    });

    return updated;
  }

  async history(limit = 100) {
    const take = Math.min(Math.max(Number(limit) || 100, 1), 300);
    const posts = await this.prisma.socialPost.findMany({
      orderBy: [{ postedAt: 'desc' }, { updatedAt: 'desc' }],
      take,
    });

    const postIds = posts.map((p) => p.id);
    const audits = postIds.length
      ? await this.prisma.auditLog.findMany({
          where: {
            resourceType: 'social_post',
            resourceId: { in: postIds },
            action: { in: ['scheduler.social_publish.sent', 'scheduler.social_publish.failed', 'facebook.publish'] as any },
          } as any,
          orderBy: { createdAt: 'desc' },
          take: take * 2,
        })
      : [];

    const auditByPost = new Map<string, any[]>();
    for (const a of audits as any[]) {
      const arr = auditByPost.get(String(a.resourceId)) || [];
      arr.push(a);
      auditByPost.set(String(a.resourceId), arr);
    }

    return posts.map((p: any) => {
      const related = auditByPost.get(String(p.id)) || [];
      const lastFailure = related.find((a: any) => String(a.action).includes('failed'));
      return {
        id: p.id,
        channel: p.channel,
        status: p.status,
        body: p.body,
        scheduledAt: p.scheduledAt,
        postedAt: p.postedAt,
        externalPostId: p.externalPostId,
        diagnostics: {
          hasExternalPostId: !!p.externalPostId,
          lastFailure: lastFailure ? ((lastFailure.metadata as any)?.error || 'publish failed') : null,
          auditEvents: related.length,
        },
      };
    });
  }

  /**
   * Aggregated cross-platform funnel for the /social Analytics tab.
   * Counts last 30 days of SocialPost rows by status × channel, plus
   * LinkedIn DM totals + Meta DM totals + replies (ReplyAnalysis rows
   * pointing at social_post / linkedin_message / meta_message).
   */
  async analyticsSummary() {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [posts, liDms, metaDms, socialReplies] = await Promise.all([
      this.prisma.socialPost.findMany({
        where: { createdAt: { gte: since } },
        select: { channel: true, status: true, engagementStats: true },
      }),
      this.prisma.linkedinMessage.count({ where: { createdAt: { gte: since } } }),
      (this.prisma as any).metaMessage.count({ where: { createdAt: { gte: since } } }),
      (this.prisma as any).replyAnalysis.count({
        where: { createdAt: { gte: since }, subjectType: { in: ['social_post', 'linkedin_message', 'meta_message'] } },
      }),
    ]);

    const byChannel: Record<string, { drafts: number; approved: number; scheduled: number; posted: number }> = {};
    for (const p of posts as any[]) {
      const ch = String(p.channel);
      if (!byChannel[ch]) byChannel[ch] = { drafts: 0, approved: 0, scheduled: 0, posted: 0 };
      const status = String(p.status);
      if (status === 'draft') byChannel[ch].drafts++;
      else if (status === 'approved') byChannel[ch].approved++;
      else if (status === 'scheduled') byChannel[ch].scheduled++;
      else if (status === 'posted') byChannel[ch].posted++;
    }

    const totals = {
      posts: (posts as any[]).length,
      posted: (posts as any[]).filter((p: any) => p.status === 'posted').length,
      scheduled: (posts as any[]).filter((p: any) => p.status === 'scheduled').length,
      drafts: (posts as any[]).filter((p: any) => p.status === 'draft').length,
      linkedinDms: liDms,
      metaDms,
      socialReplies,
    };

    return { since, totals, byChannel };
  }

  /**
   * Generate 3 A/B variants of the same post body, in the brand voice.
   * Used by /social Compose "Generate alternates" button.
   */
  async generateVariants(body: string, channel?: string): Promise<{ ok: boolean; variants: string[] }> {
    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (!apiKey) return { ok: false, variants: [] };

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const model = (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim();

    const systemPrompt = `Rewrite the social post 3 different ways. Keep the same core message and constraints but vary the angle, opening line, and rhythm. Each variant should feel different.

Voice rules:
- No buzzwords (revolutionize / synergy / seamless / game-changer).
- No em-dashes.
- Maximum 1 exclamation point per variant.
- ${channel ? `Target channel: ${channel}.` : ''}

Return STRICT JSON: {"variants":["<variant 1>","<variant 2>","<variant 3>"]}. No prose, no fences.`;

    try {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Original post:\n---\n${String(body || '').slice(0, 2000)}\n---\n\nReturn the JSON now.` }],
      });
      const raw = (resp.content || [])
        .map((b: any) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim()
        .replace(/^```json\s*/, '')
        .replace(/```\s*$/, '')
        .trim();
      const parsed = JSON.parse(raw);
      const variants: string[] = Array.isArray(parsed?.variants) ? parsed.variants.map((v: any) => String(v || '').trim()).filter(Boolean) : [];
      return { ok: true, variants: variants.slice(0, 3) };
    } catch {
      return { ok: false, variants: [] };
    }
  }

  /**
   * Rule-based "best time to post" hint per platform. v1 — fixed windows
   * pulled from common B2B engagement studies. v2 (deferred) learns from
   * the user's own posted/engagement history.
   */
  bestTimeHint(channel: string): { suggestion: string; nextWindowAtIso: string } {
    const ch = String(channel || '').toUpperCase();
    const now = new Date();
    const day = now.getDay(); // 0=Sun .. 6=Sat
    const hour = now.getHours();

    // Default: LinkedIn Tue/Wed/Thu 9-11am, IG 6-8pm any weekday, FB 1-3pm weekdays, YT evenings
    let target = new Date(now);
    let suggestion = '';
    if (ch === 'LINKEDIN') {
      // pick next Tue/Wed/Thu 9am
      let dayOffset = 0;
      while (true) {
        const candidate = new Date(now); candidate.setDate(now.getDate() + dayOffset); candidate.setHours(9, 30, 0, 0);
        const cd = candidate.getDay();
        if ([2, 3, 4].includes(cd) && candidate.getTime() > now.getTime()) { target = candidate; break; }
        dayOffset++;
        if (dayOffset > 7) break;
      }
      suggestion = 'LinkedIn engages best Tue/Wed/Thu 9–11 am.';
    } else if (ch === 'INSTAGRAM') {
      target = new Date(now); target.setHours(19, 0, 0, 0);
      if (hour >= 19) target.setDate(target.getDate() + 1);
      suggestion = 'Instagram peaks at 6–8 pm in your audience\'s time zone.';
    } else if (ch === 'FACEBOOK') {
      target = new Date(now); target.setHours(13, 30, 0, 0);
      if (hour >= 14 || day === 0 || day === 6) {
        do { target.setDate(target.getDate() + 1); } while (target.getDay() === 0 || target.getDay() === 6);
      }
      suggestion = 'Facebook is most active 1–3 pm on weekdays.';
    } else if (ch === 'YOUTUBE') {
      target = new Date(now); target.setHours(20, 0, 0, 0);
      if (hour >= 20) target.setDate(target.getDate() + 1);
      suggestion = 'YouTube viewership peaks 7–10 pm.';
    } else {
      target = new Date(now.getTime() + 4 * 3600 * 1000);
      suggestion = 'Pick a time when your audience is most active.';
    }

    return { suggestion, nextWindowAtIso: target.toISOString() };
  }

  async captureFeedback(id: string, notes: string) {
    const existing = await this.prisma.socialPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Social post not found');

    const stats = (existing.engagementStats as any) || {};
    const feedback = Array.isArray(stats.feedback) ? stats.feedback : [];
    feedback.push({ at: new Date().toISOString(), notes });

    const updated = await this.prisma.socialPost.update({
      where: { id },
      data: { engagementStats: { ...stats, feedback } as any },
    });

    await this.events.publish({ eventType: 'POST_DRAFT_CREATED', payload: { socialPostId: id, feedback: true } });
    return { ok: true, id: updated.id };
  }
}
