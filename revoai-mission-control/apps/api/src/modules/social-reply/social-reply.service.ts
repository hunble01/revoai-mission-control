import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';

// Reply Intelligence for social comments + DMs. Mirror of leads.service.assistReply
// but with platform-specific subject types: 'social_post' (comments under our
// posts) and 'linkedin_message' / 'meta_message' (DM threads).
//
// Reuses the polymorphic ReplyAnalysis table — same persistence, same apply
// pattern, same UI shape — so the /social DMs tab and /linkedin can both
// surface the same Reply Intelligence component the email flow uses.

type SubjectType = 'social_post' | 'linkedin_message' | 'meta_message';

@Injectable()
export class SocialReplyService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadSubject(subjectType: SubjectType, subjectId: string) {
    if (subjectType === 'social_post') {
      const post = await this.prisma.socialPost.findUnique({ where: { id: subjectId } });
      if (!post) throw new NotFoundException('Social post not found');
      return {
        contextLabel: `${post.channel} post`,
        ourMessage: post.body,
        channelHint: String(post.channel),
      };
    }
    if (subjectType === 'linkedin_message') {
      const msg = await this.prisma.linkedinMessage.findUnique({ where: { id: subjectId } });
      if (!msg) throw new NotFoundException('LinkedIn message not found');
      return {
        contextLabel: 'LinkedIn DM',
        ourMessage: msg.messageBody,
        channelHint: 'LINKEDIN',
      };
    }
    const msg = await (this.prisma as any).metaMessage.findUnique({ where: { id: subjectId } });
    if (!msg) throw new NotFoundException('Meta message not found');
    return {
      contextLabel: `${msg.channel} DM`,
      ourMessage: msg.messageBody,
      channelHint: msg.channel,
    };
  }

  /**
   * Classify an inbound social reply (comment or DM) and draft a response.
   * Persists the analysis to the polymorphic ReplyAnalysis table so the UI
   * can show history per subject (per post / per thread).
   */
  async assistSocialReply(subjectType: SubjectType, subjectId: string, replyText: string) {
    if (!['social_post', 'linkedin_message', 'meta_message'].includes(subjectType)) {
      throw new BadRequestException(`Invalid subjectType: ${subjectType}`);
    }
    const trimmed = String(replyText || '').trim();
    if (!trimmed) throw new BadRequestException('replyText required');

    const subject = await this.loadSubject(subjectType, subjectId);

    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (!apiKey) throw new BadRequestException('ANTHROPIC_API_KEY not configured');

    const model = (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim();
    const brand = await this.prisma.brandSettings.findUnique({ where: { id: 'default' } });
    const senderName = brand?.yourName || 'Michael';
    const senderCompany = brand?.companyName || 'RevoAI';

    const systemPrompt = `You are ${senderName}, founder of ${senderCompany}. Someone responded to your ${subject.contextLabel}. Analyze their reply and return STRICT JSON only:

{
  "intent": "interested" | "objection" | "question" | "not_interested" | "praise" | "spam" | "unsubscribe" | "other",
  "confidence": 0.0-1.0,
  "reasoning": "<one short sentence — what signals led to this classification>",
  "recommendedAction": "reply_now" | "reply_after_check" | "ignore" | "block_user" | "no_action",
  "suggestedResponse": "<2-4 sentence reply in founder voice if reply_now or reply_after_check; else empty>"
}

Voice rules for suggestedResponse:
- Conversational, founder-voice, NO em-dashes, NO buzzwords (revolutionize / synergy / seamless).
- LinkedIn replies under 280 chars, comment replies under 500 chars.
- Address their actual concern. If they asked about price → $97/mo CAD, 10-min setup.
- If objection → acknowledge, pivot to one concrete value point.
- Praise → short thanks + soft hook to a CTA only if natural.
- Sign with "— ${senderName}" only on DMs, NOT public comments.`;

    const userMsg = [
      `Channel: ${subject.channelHint}`,
      `Our original message:\n---\n${String(subject.ourMessage).slice(0, 1500)}\n---`,
      `\nTheir reply:\n---\n${trimmed.slice(0, 3000)}\n---`,
      '',
      'Return the JSON now.',
    ].join('\n');

    let parsed: any;
    try {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model,
        max_tokens: 700,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }],
      });
      const raw = (resp.content || [])
        .map((b: any) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim()
        .replace(/^```json\s*/, '')
        .replace(/```\s*$/, '')
        .trim();
      parsed = JSON.parse(raw);
    } catch (err: any) {
      throw new BadRequestException(`social-reply analysis failed: ${err?.message || err}`);
    }

    const intent = String(parsed?.intent || 'other');
    const confidence = Number(parsed?.confidence || 0);
    const reasoning = String(parsed?.reasoning || '');
    const recommendedAction = String(parsed?.recommendedAction || 'no_action');
    const suggestedResponse = String(parsed?.suggestedResponse || '');

    const saved = await (this.prisma as any).replyAnalysis.create({
      data: {
        subjectType,
        subjectId,
        leadId: null,
        replyText: trimmed.slice(0, 8000),
        intent,
        confidence,
        reasoning,
        recommendedAction,
        suggestedResponse,
      },
    });

    return {
      ok: true,
      id: saved.id,
      intent,
      confidence,
      reasoning,
      recommendedAction,
      suggestedResponse,
    };
  }

  async listAnalyses(subjectType: SubjectType, subjectId: string, limit = 10) {
    if (!['social_post', 'linkedin_message', 'meta_message'].includes(subjectType)) {
      throw new BadRequestException(`Invalid subjectType: ${subjectType}`);
    }
    return (this.prisma as any).replyAnalysis.findMany({
      where: { subjectType, subjectId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 10, 50),
    });
  }
}
