import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';

// Trend-jacking content engine.
//
// Sources:
//   - Hacker News top 30 (public Firebase API, no key)
//   - Reddit /r/smallbusiness top of week (public .json endpoint, no key)
//   - Google News RSS for the user's niche (no key)
//
// Outputs are stored as TrendingItem rows. The /content-calendar Trends
// tab lists them; one click drafts a brand-voice post that comments on the
// story (saves a SocialPost row tied to the platform of the user's choice).

const HN_API = 'https://hacker-news.firebaseio.com/v0';
const REDDIT_BASE = 'https://www.reddit.com/r/smallbusiness/top.json?t=week&limit=10';
const GOOGLE_NEWS_RSS = (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

const TREND_POST_PROMPT = `You are a founder writing a short social post commenting on a current trend or news story. Goal: insert RevoAI's perspective without forcing a sales pitch.

Voice rules:
- Conversational, founder-tone. No buzzwords (revolutionize / synergy / seamless).
- No em-dashes.
- Maximum 1 exclamation point.
- Cite the trend specifically (one phrase from the title is fine; do not include the URL inline — a "via" line at the end is OK).
- Tie it to RevoAI's world (AI receptionist for local service businesses) only if the connection is natural. If the trend is unrelated, just give a thoughtful take without forcing the product in.
- Length: tune to the requested platform.

Return STRICT JSON: {"body": "<the post>", "hook": "<one-line summary of your angle>"}`;

@Injectable()
export class TrendsService {
  private readonly log = new Logger('TrendsService');

  constructor(private readonly prisma: PrismaService) {}

  async list(source?: string, limit = 50) {
    const where: any = { dismissed: false };
    if (source) where.source = source;
    return (this.prisma as any).trendingItem.findMany({
      where,
      orderBy: [{ score: 'desc' }, { fetchedAt: 'desc' }],
      take: Math.min(Number(limit) || 50, 200),
    });
  }

  async dismiss(id: string) {
    await (this.prisma as any).trendingItem.update({ where: { id }, data: { dismissed: true } });
    return { ok: true };
  }

  /**
   * Pull from all configured sources in parallel. Idempotent on (source, url).
   */
  async refresh(niche?: string) {
    const tasks: Array<Promise<any>> = [
      this.fetchHackerNews().catch((e) => { this.log.warn(`HN fetch failed: ${e?.message || e}`); return []; }),
      this.fetchReddit().catch((e) => { this.log.warn(`Reddit fetch failed: ${e?.message || e}`); return []; }),
    ];
    if (niche) {
      tasks.push(this.fetchGoogleNews(niche).catch((e) => { this.log.warn(`Google News fetch failed: ${e?.message || e}`); return []; }));
    }
    const results = await Promise.all(tasks);
    const flat = results.flat();
    let inserted = 0;
    for (const item of flat) {
      try {
        await (this.prisma as any).trendingItem.upsert({
          where: { source_url: { source: item.source, url: item.url } },
          create: item,
          update: { score: item.score, summary: item.summary, fetchedAt: new Date() },
        });
        inserted++;
      } catch { /* skip dupes silently */ }
    }
    return { ok: true, totalFetched: flat.length, persisted: inserted };
  }

  private async fetchHackerNews() {
    const topRes = await fetch(`${HN_API}/topstories.json`);
    if (!topRes.ok) return [];
    const ids = (await topRes.json()) as number[];
    const top = ids.slice(0, 30);
    const stories = await Promise.all(top.map(async (id) => {
      try {
        const r = await fetch(`${HN_API}/item/${id}.json`);
        return r.ok ? (await r.json()) : null;
      } catch { return null; }
    }));
    return stories
      .filter((s: any) => s?.title && s?.url)
      .map((s: any) => ({
        source: 'hacker_news',
        title: String(s.title).slice(0, 300),
        url: String(s.url).slice(0, 500),
        summary: null,
        score: Number(s.score || 0),
        publishedAt: s.time ? new Date(Number(s.time) * 1000) : null,
      }));
  }

  private async fetchReddit() {
    const r = await fetch(REDDIT_BASE, { headers: { 'user-agent': 'RevoAI-Mission-Control/1.0' } });
    if (!r.ok) return [];
    const j: any = await r.json();
    const posts = j?.data?.children || [];
    return posts
      .map((p: any) => p?.data)
      .filter((d: any) => d?.title && d?.url)
      .map((d: any) => ({
        source: 'reddit',
        title: String(d.title).slice(0, 300),
        url: String(d.url || `https://www.reddit.com${d.permalink}`).slice(0, 500),
        summary: d.selftext ? String(d.selftext).slice(0, 400) : null,
        score: Number(d.ups || 0),
        publishedAt: d.created_utc ? new Date(Number(d.created_utc) * 1000) : null,
      }));
  }

  private async fetchGoogleNews(niche: string) {
    const r = await fetch(GOOGLE_NEWS_RSS(niche));
    if (!r.ok) return [];
    const xml = await r.text();
    // Lightweight RSS parse — pull <item><title>..</title><link>..</link><pubDate>..</pubDate>
    const items: any[] = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const block = m[1];
      const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/);
      const linkMatch = block.match(/<link>(.*?)<\/link>/);
      const dateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/);
      if (titleMatch && linkMatch) {
        items.push({
          source: 'google_news',
          title: String(titleMatch[1]).slice(0, 300),
          url: String(linkMatch[1]).slice(0, 500),
          summary: null,
          score: null,
          publishedAt: dateMatch ? new Date(dateMatch[1]) : null,
        });
      }
      if (items.length >= 20) break;
    }
    return items;
  }

  /**
   * Take a TrendingItem + target platform → Claude drafts a brand-voice post
   * commenting on the trend. Saves the post as a SocialPost row in 'draft'
   * status, marks the trend as drafted (drafted_at).
   */
  async draftPostFromTrend(trendId: string, channel: string) {
    const trend = await (this.prisma as any).trendingItem.findUnique({ where: { id: trendId } });
    if (!trend) throw new NotFoundException('Trend not found');

    const ch = String(channel || 'LINKEDIN').toUpperCase();
    if (!['LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE'].includes(ch)) {
      throw new BadRequestException('Invalid channel');
    }

    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (!apiKey) throw new BadRequestException('ANTHROPIC_API_KEY not configured');
    const model = (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim();

    const lengthHint = ch === 'LINKEDIN' ? '250-350 chars' : ch === 'FACEBOOK' ? '200-300 chars' : ch === 'INSTAGRAM' ? '150-250 chars' : '60-120 chars (YouTube short hook)';

    const userMsg = [
      `Platform: ${ch}`,
      `Target length: ${lengthHint}`,
      `Trend source: ${trend.source}`,
      `Trend title: ${trend.title}`,
      trend.summary ? `Trend summary: ${trend.summary}` : null,
      `Source URL: ${trend.url}`,
      '',
      'Return the JSON now.',
    ].filter(Boolean).join('\n');

    let parsed: any = null;
    try {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model,
        max_tokens: 700,
        system: TREND_POST_PROMPT,
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
      throw new BadRequestException(`Trend post generation failed: ${err?.message || err}`);
    }

    const body = String(parsed?.body || '').trim();
    if (!body) throw new BadRequestException('LLM returned empty body');

    const post = await this.prisma.socialPost.create({
      data: {
        channel: ch as any,
        body,
        status: 'draft',
        sourceType: 'trend',
        engagementStats: { trendId, trendSource: trend.source, trendUrl: trend.url, hook: parsed?.hook || '' } as any,
      } as any,
    });

    await (this.prisma as any).trendingItem.update({ where: { id: trendId }, data: { draftedAt: new Date() } });

    return { ok: true, post, hook: parsed?.hook || '' };
  }
}
