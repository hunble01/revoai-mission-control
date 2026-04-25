import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a content strategist for a B2B SaaS that sells an AI chatbot + SMS assistant to local service businesses (barbershops, med spas, clinics, gyms, agencies, law firms).

Generate 6 social-media content ideas. Return STRICTLY a JSON array — no prose, no markdown fences. Each item:
{
  "platform": "LINKEDIN" | "FACEBOOK" | "INSTAGRAM" | "YOUTUBE_SHORT" | "BOTH",
  "headline": "<hook-first headline, 6-12 words>",
  "source": "Original" | "Industry Report" | "Customer Story" | "Competitor Insight" | "Google News" | "YouTube" | "Reddit",
  "contentType": "Educational" | "Social Proof" | "Engagement" | "Behind-The-Scenes",
  "angle": "<one sentence — the specific pain or insight this post addresses>",
  "aiDraft": "<200-350 char draft post, natural voice, no hashtag spam, no 'revolutionize', no em-dashes>"
}

Distribution: 2 LINKEDIN, 1 FACEBOOK, 1 INSTAGRAM, 1 YOUTUBE_SHORT, 1 BOTH. Mix contentTypes — at least one Educational, one Social Proof, one Engagement.

Voice rules:
- Honest, specific, conversational. Write like a founder, not a marketing team.
- No corporate buzzwords ("revolutionize", "game-changer", "seamless", "solution").
- Never use em-dashes (—). Use periods or commas.
- LinkedIn posts can be ~250-350 chars; Facebook ~200-300; Instagram ~150-250 with vibe; YouTube Short hooks <80 chars.
- Don't end every post with a question. One of six, at most.
- Use numbers and concrete outcomes where possible.
- Avoid more than one emoji per post.

DO NOT include any field outside the schema. DO NOT wrap in a code fence.`;

const RENDER_ALL_PROMPT = `You take ONE social content idea and rewrite it as 4 native variants — one for LinkedIn, Facebook, Instagram, and YouTube Short script. Return STRICTLY this JSON shape:
{
  "linkedin": "<250-350 char post, professional but warm, founder voice>",
  "facebook": "<200-300 char post, conversational, broader audience>",
  "instagram": "<150-250 char caption + 5-10 niche hashtags appended on a new line>",
  "youtube_short": "<60-90 second script in beats: HOOK / PROBLEM / TURN / CTA. Plain text, line-broken between beats>"
}

Voice rules — apply to all 4:
- No buzzwords ("revolutionize", "game-changer", "seamless").
- No em-dashes.
- Maximum one exclamation point in any single variant.
- Concrete over abstract.
- Each variant should feel native to its platform, not a copy-paste.

Output JSON only.`;

const HASHTAG_PROMPT = `Suggest 5-10 niche hashtags (no spam tags) for the post and niche given. Mix 2-3 broad (#smallbusiness), 3-5 niche (#medspamarketing), and 1-2 location/community where relevant. Return STRICTLY a JSON array of strings each starting with #. No prose, no fences.`;

// RevoAI-specific product post generator. Used by the autopilot to produce
// posts ABOUT RevoAI itself (vs. generic content strategy or trend-jacking).
// Bakes in product facts so posts actually sell what we sell.
const REVOAI_PRODUCT_PROMPT = `You are the founder of RevoAI writing a single short social post about your own product.

PRODUCT FACTS (the only ones you may cite):
- RevoAI is an AI receptionist for local service businesses (barbershops, med spas, clinics, gyms, agencies, salons, law firms, contractors)
- 24/7 call answering with sub-second response, real human-sounding voice (no robotic IVR)
- Books appointments straight into Google / Outlook / iCloud calendar in real time, no double-booking
- Two-way SMS handles questions, confirmations, reminders
- AI chatbox for the website captures leads 24/7
- Live dashboard shows every call, text, and booking as they happen
- Plans from $97/mo CAD (vs ~$2,500+/mo for a human receptionist), 7-day free trial, 10-minute setup, no contract
- Currently early access, full launch 2026
- Sign-up URL: https://revoai.ca/sign-up

ABSOLUTE BRAND RULES (violating any breaks the brand):
- NEVER say "revolutionize", "game-changer", "synergy", "seamless", "best-in-class", "in today's fast-paced world"
- NEVER claim "no credit card required" — a card IS required (the trial just doesn't charge)
- NEVER cite review counts, star ratings, or testimonials we don't have
- NEVER mention competitors by name
- NEVER promise specific ROI as a guarantee ("will make you $X")
- Maximum ONE exclamation mark per post; zero is better
- Never use em-dashes (—). Use periods or commas.
- No "AI-powered" — describe what it actually does
- Never invent specifics about businesses

VOICE: warm, professional, calm, founder-tone. Botanical/organic — not aggressive SaaS. Confident, not pushy. Concrete numbers and outcomes where possible. Plain language.

REQUESTED ANGLE — write the post strictly through this lens:
{ANGLE_INSTRUCTION}

PLATFORM: {PLATFORM} — target length:
- LINKEDIN: 250-350 chars body
- FACEBOOK: 200-300 chars body
- INSTAGRAM: 150-250 chars body, image is the hero
- YOUTUBE: 60-100 char hook (used as Short title/caption)

OUTPUT — return STRICT JSON only, no preamble, no fences:
{
  "headline": "<6-12 word internal title for the post>",
  "body": "<the post body, length appropriate for platform>",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "imagePromptHint": "<one sentence visual direction for a hero image — subject, mood, composition, color, no people's faces, no text in image>"
}`;

const ANGLE_INSTRUCTIONS: Record<string, string> = {
  feature: 'Highlight ONE specific RevoAI feature (24/7 call answering, SMS booking, calendar integration, AI chatbox, live dashboard) and the concrete problem it solves for a local-service business. Stay on one feature.',
  pain: 'Open with a sharp, specific pain point a local-service business owner feels (missed calls during a haircut, no-shows wrecking the schedule, after-hours leads going to competitors, voicemail-tag death spiral). Pivot to how RevoAI fixes that pain. Concrete, not abstract.',
  value: 'Compare $97/mo CAD RevoAI to alternatives: $2,500+/mo human receptionist, $0/mo doing nothing and losing the lead. Show the math plainly — not a sales pitch, just the numbers and what they mean.',
  bts: 'Founder voice. Building-in-public energy. A specific decision, lesson, or moment from running RevoAI — what we changed, what we learned, what we observed about local-service buyers. No fake humility, no hustle-porn. Real and small.',
  educational: 'Teach something useful about how AI receptionists work, what they actually handle vs. don\'t, common myths (e.g. "people will hate talking to a bot" — modern voice models are good now), or how a small business should think about call automation. Useful even if the reader never buys.',
  caseStudy: 'Hypothetical scenario only — never invent a real customer testimonial. Frame as "imagine a 6-chair barbershop that misses 12 calls a week. With RevoAI those 12 calls get answered, X% book on the spot..." — keep numbers conservative and grounded. End with the soft CTA.',
};

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

  /**
   * Take one ContentIdea and emit 4 native platform variants (LinkedIn /
   * Facebook / Instagram / YouTube Short). Each variant becomes a SocialPost
   * row sharing the same `groupId` so the /social Queue + Calendar can render
   * them as a single bundle.
   *
   * The YouTube short variant is a script (not a video upload) — the user
   * records/edits it themselves. Its SocialPost row carries the script in
   * `body` and is left in 'draft' status (no auto-publish for YouTube in
   * Wave 1).
   */
  async renderAcrossPlatforms(ideaId: string) {
    const idea = await this.prisma.contentIdea.findUnique({ where: { id: ideaId } });
    if (!idea) return { ok: false, error: 'Idea not found' };

    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY not configured' };
    const model = (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim();
    const ctx = await this.buildContext();

    const userMsg = [
      `Brand: ${ctx.companyName}, authored by ${ctx.yourName}.`,
      `Audience: ${ctx.niche}${ctx.subNiche ? ` (${ctx.subNiche})` : ''}.`,
      `Idea headline: ${idea.headline}`,
      idea.angle ? `Angle: ${idea.angle}` : null,
      idea.aiDraft ? `\nFirst-pass draft (rewrite for each platform):\n${idea.aiDraft}` : null,
      '',
      'Return the JSON now.',
    ].filter(Boolean).join('\n');

    let parsed: any = null;
    try {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model,
        max_tokens: 1500,
        system: RENDER_ALL_PROMPT,
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
      this.log.warn(`renderAcrossPlatforms LLM failed: ${err?.message || err}`);
      return { ok: false, error: `Generation failed: ${err?.message || err}` };
    }

    const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const variants: Array<{ channel: 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM'; body: string }> = [];
    if (parsed?.linkedin) variants.push({ channel: 'LINKEDIN', body: String(parsed.linkedin).slice(0, 3000) });
    if (parsed?.facebook) variants.push({ channel: 'FACEBOOK', body: String(parsed.facebook).slice(0, 5000) });
    if (parsed?.instagram) variants.push({ channel: 'INSTAGRAM', body: String(parsed.instagram).slice(0, 2200) });

    const created: any[] = [];
    for (const v of variants) {
      const row = await this.prisma.socialPost.create({
        data: {
          channel: v.channel as any,
          body: v.body,
          status: 'draft',
          sourceType: 'ai_render',
          groupId,
        } as any,
      });
      created.push(row);
    }

    // YouTube short — separate handling, status stays 'draft', not auto-publishable in Wave 1
    let youtubeScript: string | null = null;
    if (parsed?.youtube_short) {
      youtubeScript = String(parsed.youtube_short).slice(0, 4000);
    }

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        action: 'content.render_all_platforms',
        resourceType: 'content_idea',
        resourceId: ideaId,
        metadata: { groupId, variantsCreated: created.length, hasYouTube: !!youtubeScript } as any,
      },
    });

    return {
      ok: true,
      groupId,
      variants: created,
      youtubeScript,
    };
  }

  /**
   * 5-10 niche hashtags from the post body + brand niche. IG variants
   * call this automatically; the /social Composer can also call it on demand
   * for any platform.
   */
  async suggestHashtags(body: string, niche?: string) {
    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY not configured', hashtags: [] };
    const model = (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim();

    const ctx = await this.buildContext();
    const effectiveNiche = String(niche || ctx.niche || 'local services').trim();

    try {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model,
        max_tokens: 400,
        system: HASHTAG_PROMPT,
        messages: [{
          role: 'user',
          content: `Niche: ${effectiveNiche}\n\nPost:\n${String(body || '').slice(0, 1500)}\n\nReturn the JSON array now.`,
        }],
      });
      const raw = (resp.content || [])
        .map((b: any) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim()
        .replace(/^```json\s*/, '')
        .replace(/```\s*$/, '')
        .trim();
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return { ok: false, error: 'Bad LLM response shape', hashtags: [] };
      const cleaned = arr
        .map((h: any) => String(h || '').trim())
        .filter((h) => h.startsWith('#') && h.length > 1 && h.length <= 50)
        .slice(0, 12);
      return { ok: true, hashtags: cleaned };
    } catch (err: any) {
      this.log.warn(`suggestHashtags failed: ${err?.message || err}`);
      return { ok: false, error: `Hashtag suggestion failed: ${err?.message || err}`, hashtags: [] };
    }
  }

  /**
   * Generate ONE RevoAI-product-focused social post for a specific platform
   * and angle. Used by the autopilot. Pulls REVOAI_PRODUCT_PROMPT, fills in
   * the platform + angle slots, returns parsed { headline, body, hashtags,
   * imagePromptHint } for the caller to persist as a SocialPost.
   *
   * If avoidTopics is supplied (last N autopilot headlines), they're
   * appended to the user message so Claude rotates angles instead of
   * repeating itself.
   */
  async generateRevoAIPost(opts: { platform: 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM' | 'YOUTUBE'; angle: keyof typeof ANGLE_INSTRUCTIONS; avoidTopics?: string[] }): Promise<{ ok: boolean; headline: string; body: string; hashtags: string[]; imagePromptHint: string; angle: string; error?: string }> {
    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (!apiKey) return { ok: false, headline: '', body: '', hashtags: [], imagePromptHint: '', angle: opts.angle, error: 'ANTHROPIC_API_KEY not configured' };

    const angleInstruction = ANGLE_INSTRUCTIONS[opts.angle] || ANGLE_INSTRUCTIONS.feature;
    const ctx = await this.buildContext();
    const model = (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim();

    const systemPrompt = REVOAI_PRODUCT_PROMPT
      .replace('{ANGLE_INSTRUCTION}', angleInstruction)
      .replace('{PLATFORM}', opts.platform);

    const userMsgParts: string[] = [
      `Brand: ${ctx.companyName}, authored by ${ctx.yourName}.`,
      ctx.niche ? `Active campaign niche we can lean into: ${ctx.niche}${ctx.subNiche ? ` (specifically ${ctx.subNiche})` : ''}.` : null,
      ctx.painPoint ? `Customer pain we know works: ${ctx.painPoint}` : null,
    ];
    if (opts.avoidTopics && opts.avoidTopics.length) {
      userMsgParts.push(`\nRecent post headlines to avoid repeating (write something distinctly different):\n- ${opts.avoidTopics.slice(0, 8).join('\n- ')}`);
    }
    userMsgParts.push('', 'Return the JSON now.');
    const userMsg = userMsgParts.filter(Boolean).join('\n');

    try {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model,
        max_tokens: 800,
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
      const parsed = JSON.parse(raw);
      return {
        ok: true,
        angle: opts.angle,
        headline: String(parsed?.headline || '').slice(0, 200).trim(),
        body: String(parsed?.body || '').trim(),
        hashtags: Array.isArray(parsed?.hashtags)
          ? parsed.hashtags.map((h: any) => String(h || '').trim()).filter((h: string) => h.startsWith('#') && h.length > 1).slice(0, 10)
          : [],
        imagePromptHint: String(parsed?.imagePromptHint || '').trim(),
      };
    } catch (err: any) {
      this.log.warn(`generateRevoAIPost failed: ${err?.message || err}`);
      return { ok: false, angle: opts.angle, headline: '', body: '', hashtags: [], imagePromptHint: '', error: String(err?.message || err) };
    }
  }
}
