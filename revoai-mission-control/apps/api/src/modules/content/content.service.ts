import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a content strategist for a B2B SaaS that sells an AI chatbot + SMS assistant to local service businesses (barbershops, med spas, clinics, gyms, agencies, law firms).

Generate 6 social-media content ideas. Return STRICTLY a JSON array — no prose, no markdown fences. Each item:
{
  "platform": "LINKEDIN" | "FACEBOOK" | "BOTH",
  "headline": "<hook-first headline, 6-12 words>",
  "source": "Original" | "Industry Report" | "Customer Story" | "Competitor Insight" | "Google News" | "YouTube" | "Reddit",
  "contentType": "Educational" | "Social Proof" | "Engagement" | "Behind-The-Scenes",
  "angle": "<one sentence — the specific pain or insight this post addresses>",
  "aiDraft": "<200-350 char draft post, natural voice, no hashtag spam, no 'revolutionize', no em-dashes>"
}

Distribution: 2 LINKEDIN, 2 FACEBOOK, 2 BOTH. Mix contentTypes — at least one Educational, one Social Proof, one Engagement.

Voice rules:
- Honest, specific, conversational. Write like a founder, not a marketing team.
- No corporate buzzwords ("revolutionize", "game-changer", "seamless", "solution").
- Never use em-dashes (—). Use periods or commas.
- LinkedIn posts can be ~250-350 chars; Facebook ~200-300.
- Don't end every post with a question. One of six, at most.
- Use numbers and concrete outcomes where possible.
- Avoid more than one emoji per post.

DO NOT include any field outside the schema. DO NOT wrap in a code fence.`;

@Injectable()
export class ContentService {
  private readonly log = new Logger('ContentService');

  constructor(private readonly prisma: PrismaService) {}

  private async buildContext() {
    const [brand, contentSetting, activeCampaign] = await Promise.all([
      this.prisma.brandSettings.findUnique({ where: { id: 'default' } }),
      this.prisma.setting.findUnique({ where: { key: 'content_intelligence' } }),
      this.prisma.campaign.findFirst({ where: { isActive: true } }),
    ]);
    const ci = (contentSetting?.value as any) || {};
    const topics: string[] = Array.isArray(ci.contentTopics) ? ci.contentTopics : [];
    const competitors: any[] = Array.isArray(ci.competitors) ? ci.competitors : [];

    return {
      companyName: brand?.companyName || 'RevoAI',
      yourName: brand?.yourName || 'Michael',
      niche: activeCampaign?.niche || 'local service businesses',
      subNiche: activeCampaign?.subNiche || '',
      painPoint: activeCampaign?.painPoint || '',
      yourOffer: activeCampaign?.yourOffer || '',
      topics: topics.slice(0, 8),
      competitors: competitors.slice(0, 5).map((c: any) => c?.name || c?.handle).filter(Boolean),
    };
  }

  private async generateIdeasWithLLM(): Promise<any[] | null> {
    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (!apiKey) return null;
    const model = (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim();
    const ctx = await this.buildContext();

    const userMsg = [
      `Brand: ${ctx.companyName}, authored by ${ctx.yourName}.`,
      `Target audience: ${ctx.niche}${ctx.subNiche ? ` (specifically ${ctx.subNiche})` : ''}.`,
      ctx.painPoint ? `Known customer pain: ${ctx.painPoint}` : null,
      ctx.yourOffer ? `Product offer: ${ctx.yourOffer}` : null,
      ctx.topics.length ? `Content topics to draw from: ${ctx.topics.join(', ')}.` : null,
      ctx.competitors.length ? `Competitors to be aware of (don't name them): ${ctx.competitors.join(', ')}.` : null,
      '',
      'Return the JSON array now.',
    ].filter(Boolean).join('\n');

    try {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model,
        max_tokens: 2200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      });
      const raw = (resp.content || [])
        .map((b: any) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim()
        .replace(/^```json\s*/, '')
        .replace(/```\s*$/, '')
        .trim();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed.slice(0, 10).filter((i) => i?.headline && i?.aiDraft && i?.platform);
    } catch (err: any) {
      this.log.warn(`generateIdeasWithLLM failed: ${err?.message || err}`);
      return null;
    }
  }

  async generateIdeas() {
    const jobId = `content_${Date.now()}`;
    // Fire-and-forget so the HTTP handler returns immediately
    setTimeout(async () => {
      try {
        const llmIdeas = await this.generateIdeasWithLLM();
        const ideas = llmIdeas && llmIdeas.length
          ? llmIdeas
          : [
              // Fallback when no API key — keeps the page useful in dev
              { platform: 'BOTH', headline: 'Why local businesses lose leads overnight', source: 'Google News', contentType: 'Educational', angle: 'Speed-to-lead breakdown', aiDraft: 'Most local businesses lose hot leads after hours. Here is how to fix that in 3 steps.' },
              { platform: 'LINKEDIN', headline: 'No-show reduction playbook for clinics', source: 'YouTube', contentType: 'Social Proof', angle: 'Appointment reminder system', aiDraft: 'No-shows are avoidable. A simple reminder stack reduced missed visits with timing changes.' },
              { platform: 'FACEBOOK', headline: 'Community trust beats ad spend', source: 'Reddit', contentType: 'Engagement', angle: 'Neighborhood-first messaging', aiDraft: 'Before spending more on ads, tighten local trust signals in your follow-up and booking flow.' },
            ];
        for (const s of ideas) {
          await this.prisma.contentIdea.create({ data: {
            platform: String(s.platform || 'BOTH').toUpperCase(),
            headline: String(s.headline || '').slice(0, 200),
            source: String(s.source || 'Original').slice(0, 60),
            contentType: String(s.contentType || 'Educational').slice(0, 40),
            angle: String(s.angle || '').slice(0, 300),
            aiDraft: String(s.aiDraft || '').slice(0, 1200),
          } as any });
        }
      } catch (err: any) {
        this.log.error(`generateIdeas job failed: ${err?.message || err}`);
      }
    }, 100);
    return { status: 'running', jobId };
  }

  listIdeas() {
    return this.prisma.contentIdea.findMany({ where: { dismissed: false }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async dismissIdea(id: string) {
    await this.prisma.contentIdea.update({ where: { id }, data: { dismissed: true } as any });
    return { ok: true };
  }
}
