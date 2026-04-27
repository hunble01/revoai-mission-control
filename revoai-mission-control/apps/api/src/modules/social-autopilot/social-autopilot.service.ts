import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { ContentService } from '../content/content.service';
import { SocialPostsService } from '../social-posts/social-posts.service';
import { ImagesService } from '../images/images.service';
import { TrendsService } from '../trends/trends.service';

// Social autopilot orchestrator. Runs the full pipeline once per tick:
//   1. Load config from Setting('social_autopilot_config')
//   2. Cap check: bail if already at postsPerDay for today
//   3. Pick next platform via round-robin
//   4. Pick product vs trend angle by mixProductPct
//   5. Generate (RevoAI prompt for product, draftPostFromTrend for trend)
//   6. Brand-voice + AI review gate (warn, don't block)
//   7. Auto-image if config.autoImage
//   8. Schedule into next bestTimeHint window for the platform
//   9. Save SocialPost as 'draft' (or 'scheduled' if autoApprove)
//  10. Update Setting state (lastTopics, lastPlatform, lastRunAt)

type Platform = 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM' | 'YOUTUBE';

type AutopilotConfig = {
  enabled: boolean;
  postsPerDay: number;
  mixProductPct: number; // 0-100
  autoApprove: boolean;
  autoImage: boolean;
  platforms: Platform[];
  lastPlatform: Platform | null;
  lastRunAt: string | null;
  lastTopics: string[];
};

const DEFAULT_CONFIG: AutopilotConfig = {
  enabled: false,
  postsPerDay: 1,
  mixProductPct: 70,
  autoApprove: false,
  autoImage: true,
  platforms: ['LINKEDIN', 'FACEBOOK', 'INSTAGRAM'],
  lastPlatform: null,
  lastRunAt: null,
  lastTopics: [],
};

const ANGLES = ['feature', 'pain', 'value', 'bts', 'educational', 'caseStudy'] as const;
type Angle = typeof ANGLES[number];

const SETTING_KEY = 'social_autopilot_config';

@Injectable()
export class SocialAutopilotService {
  private readonly log = new Logger('SocialAutopilot');

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly content: ContentService,
    private readonly socialPosts: SocialPostsService,
    private readonly images: ImagesService,
    private readonly trends: TrendsService,
  ) {}

  async getConfig(): Promise<AutopilotConfig> {
    const row = await this.prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    if (!row?.value) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...((row.value as any) || {}) };
  }

  async setConfig(partial: Partial<AutopilotConfig>): Promise<AutopilotConfig> {
    const current = await this.getConfig();
    const merged: AutopilotConfig = { ...current, ...partial };
    // Clamp + validate
    merged.postsPerDay = Math.max(1, Math.min(20, Number(merged.postsPerDay) || 1));
    merged.mixProductPct = Math.max(0, Math.min(100, Number(merged.mixProductPct) || 70));
    merged.platforms = Array.isArray(merged.platforms) && merged.platforms.length
      ? merged.platforms.filter((p) => ['LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE'].includes(p))
      : ['LINKEDIN'];

    await this.prisma.setting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: merged as any },
      update: { value: merged as any },
    });
    return merged;
  }

  /**
   * Status for the UI: config + today's autopilot post count + next planned platform.
   */
  async status() {
    const config = await this.getConfig();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const todayCount = await this.prisma.socialPost.count({
      where: { sourceType: 'autopilot', createdAt: { gte: startOfDay } } as any,
    });
    const nextPlatform = this.pickNextPlatform(config);
    const bestTime = this.socialPosts.bestTimeHint(nextPlatform);
    return { config, todayCount, nextPlatform, nextWindowAtIso: bestTime.nextWindowAtIso, nextSuggestion: bestTime.suggestion };
  }

  /**
   * Round-robin platform picker: takes the next enabled platform after lastPlatform,
   * wrapping. If lastPlatform isn't set or isn't in the enabled list, start from index 0.
   */
  private pickNextPlatform(config: AutopilotConfig): Platform {
    const list = config.platforms.length ? config.platforms : ['LINKEDIN'] as Platform[];
    if (!config.lastPlatform) return list[0];
    const idx = list.indexOf(config.lastPlatform);
    if (idx === -1) return list[0];
    return list[(idx + 1) % list.length];
  }

  /**
   * Cheap Jaccard-like overlap on word sets. Returns 0-1.
   */
  private jaccard(a: string, b: string): number {
    const tok = (s: string) => new Set(String(s).toLowerCase().match(/[a-z0-9]{3,}/g) || []);
    const A = tok(a), B = tok(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    A.forEach((t) => { if (B.has(t)) inter++; });
    const union = new Set<string>();
    A.forEach((t) => union.add(t));
    B.forEach((t) => union.add(t));
    return inter / union.size;
  }

  private pickAngle(lastTopics: string[]): Angle {
    // Bias toward angles whose name doesn't appear in recent headlines, otherwise random.
    const counts: Record<string, number> = {};
    ANGLES.forEach((a) => (counts[a] = 0));
    lastTopics.forEach((h) => {
      const lower = h.toLowerCase();
      if (lower.includes('feature') || lower.includes('how it')) counts.feature++;
      if (lower.includes('miss') || lower.includes('lost') || lower.includes('pain')) counts.pain++;
      if (lower.includes('cost') || lower.includes('$') || lower.includes('cheap')) counts.value++;
      if (lower.includes('built') || lower.includes('learned') || lower.includes('founder')) counts.bts++;
      if (lower.includes('how') || lower.includes('explain')) counts.educational++;
      if (lower.includes('imagine') || lower.includes('shop') || lower.includes('clinic')) counts.caseStudy++;
    });
    const minCount = Math.min(...Object.values(counts));
    const candidates = ANGLES.filter((a) => counts[a] === minCount);
    return candidates[Math.floor(Math.random() * candidates.length)] as Angle;
  }

  /**
   * Single autopilot tick. Idempotent — repeated calls within the same day after
   * postsPerDay is met return { skipped: 'cap_reached' }.
   */
  async runOnce(actor: string = 'cron'): Promise<any> {
    const config = await this.getConfig();
    if (!config.enabled && actor === 'cron') {
      return { ok: false, skipped: 'autopilot_disabled' };
    }

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const todayCount = await this.prisma.socialPost.count({
      where: { sourceType: 'autopilot', createdAt: { gte: startOfDay } } as any,
    });
    if (todayCount >= config.postsPerDay && actor === 'cron') {
      return { ok: false, skipped: 'cap_reached', todayCount, postsPerDay: config.postsPerDay };
    }

    const platform = this.pickNextPlatform(config);
    const useTrend = Math.random() * 100 >= config.mixProductPct;

    let body = '';
    let headline = '';
    let hashtags: string[] = [];
    let imagePromptHint = '';
    let angle: string = '';
    let mix: 'product' | 'trend' = useTrend ? 'trend' : 'product';
    let trendId: string | null = null;

    if (mix === 'trend') {
      // Try the trend path. If no fresh trends, fall back to product.
      const trends = await this.trends.list(undefined, 30);
      const fresh = (Array.isArray(trends) ? trends : []).find((t: any) => !t.draftedAt && !t.dismissed);
      if (fresh) {
        try {
          const draft = await this.trends.draftPostFromTrend(fresh.id, platform);
          if (draft?.ok && draft?.post?.body) {
            // draftPostFromTrend already saved a SocialPost. We want to control the save
            // ourselves so autopilot metadata gets attached. Discard their row.
            await this.prisma.socialPost.delete({ where: { id: draft.post.id } }).catch(() => null);
            body = String(draft.post.body || '').trim();
            headline = String(fresh.title || 'Trend take').slice(0, 200);
            angle = 'trend';
            trendId = fresh.id;
          } else {
            mix = 'product';
          }
        } catch {
          mix = 'product';
        }
      } else {
        mix = 'product';
      }
    }

    if (mix === 'product') {
      const chosenAngle = this.pickAngle(config.lastTopics || []);
      const result = await this.content.generateRevoAIPost({
        platform: platform as any,
        angle: chosenAngle,
        avoidTopics: config.lastTopics || [],
      });
      if (!result.ok) {
        return { ok: false, error: result.error || 'product generation failed', platform };
      }
      // Dedup: if too similar to a recent topic, retry once with explicit avoidance.
      const sims = (config.lastTopics || []).map((t) => this.jaccard(t, result.headline));
      if (sims.some((s) => s > 0.5)) {
        const retry = await this.content.generateRevoAIPost({
          platform: platform as any,
          angle: chosenAngle,
          avoidTopics: [...(config.lastTopics || []), result.headline],
        });
        if (retry.ok) {
          headline = retry.headline; body = retry.body; hashtags = retry.hashtags; imagePromptHint = retry.imagePromptHint; angle = retry.angle;
        } else {
          headline = result.headline; body = result.body; hashtags = result.hashtags; imagePromptHint = result.imagePromptHint; angle = result.angle;
        }
      } else {
        headline = result.headline; body = result.body; hashtags = result.hashtags; imagePromptHint = result.imagePromptHint; angle = result.angle;
      }
    }

    if (!body.trim()) {
      return { ok: false, error: 'empty body after generation', platform, mix };
    }

    // Brand-voice + AI review (warn-only, don't block)
    const lintIssues = this.socialPosts.validateBrandVoice(body);
    let aiIssues: any[] = [];
    try {
      const ai = await this.socialPosts.aiReview(body, platform);
      if (ai?.ok) aiIssues = ai.issues || [];
    } catch { /* silent */ }

    // Auto-image
    let mediaUrl: string | null = null;
    let imageAssetId: string | null = null;
    if (config.autoImage) {
      try {
        const visualHint = imagePromptHint || (await this.images.refinePromptForPost(body, platform));
        // Stub mode does keyword-based stock photo lookup. Combining the
        // post body with the visual hint gives the keyword extractor more
        // domain context to pick relevant tags from.
        const combinedPrompt = `${visualHint}\n\nPost context:\n${body}`;
        const size = platform === 'INSTAGRAM' ? '1024x1792' : platform === 'YOUTUBE' ? '1024x1792' : '1792x1024';
        const img = await this.images.generate({ prompt: combinedPrompt, size: size as any, platform, actorId: actor });
        if (img?.ok && img.asset?.url) {
          mediaUrl = img.asset.url;
          imageAssetId = img.asset.id;
        }
      } catch (err: any) {
        this.log.warn(`autoImage failed: ${err?.message || err}`);
      }
    }

    // Schedule into next bestTime window
    const bestTime = this.socialPosts.bestTimeHint(platform);
    const scheduledAt = new Date(bestTime.nextWindowAtIso);

    const status = config.autoApprove ? 'scheduled' : 'draft';

    const finalBody = hashtags.length ? `${body}\n\n${hashtags.join(' ')}` : body;

    const post = await this.prisma.socialPost.create({
      data: {
        channel: platform as any,
        body: finalBody,
        mediaUrl,
        scheduledAt: status === 'scheduled' ? scheduledAt : null,
        status,
        sourceType: 'autopilot',
        engagementStats: {
          autopilot: true,
          mix,
          angle,
          headline,
          trendId,
          imageAssetId,
          lintIssues: lintIssues.map((i) => i.rule),
          aiIssues: aiIssues.map((i: any) => i.rule),
          plannedFor: scheduledAt.toISOString(),
        } as any,
      } as any,
    });

    // Update config state
    const newLastTopics = [headline, ...(config.lastTopics || [])].filter(Boolean).slice(0, 30);
    await this.setConfig({
      lastPlatform: platform as any,
      lastRunAt: new Date().toISOString(),
      lastTopics: newLastTopics,
    });

    await this.prisma.auditLog.create({
      data: {
        actorType: actor === 'cron' ? 'system' : 'user',
        action: 'social.autopilot.drafted',
        resourceType: 'social_post',
        resourceId: post.id,
        metadata: { platform, mix, angle, headline, mediaUrl: !!mediaUrl, scheduledAt: scheduledAt.toISOString(), status } as any,
      },
    });

    await this.events.publish({ eventType: 'AUTOPILOT_POST_DRAFTED', payload: { id: post.id, platform, mix, angle } });

    return { ok: true, post: { id: post.id, channel: post.channel, status: post.status, body: finalBody, mediaUrl, scheduledAt: scheduledAt.toISOString() }, mix, angle, platform, plannedFor: scheduledAt.toISOString() };
  }

  /**
   * One-shot draft generator. User says "write a post about X for LinkedIn" —
   * we generate one polished post on that topic, attach an auto-image,
   * save as a draft. Skips the daily cap, the platform rotation, and the
   * 70/30 mix logic — this is a directed manual ask, not autopilot.
   */
  async quickDraft(opts: { topic: string; platform: 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM' | 'YOUTUBE'; autoImage?: boolean; actor?: string }) {
    const topic = String(opts.topic || '').trim();
    if (!topic) {
      return { ok: false, error: 'topic required' };
    }
    const platform = opts.platform || 'LINKEDIN';

    const result = await this.content.generateRevoAIPost({
      platform: platform as any,
      angle: 'feature' as any,
      topic,
    });
    if (!result.ok) {
      return { ok: false, error: result.error || 'generation failed' };
    }

    const { headline, body, hashtags, imagePromptHint } = result;
    if (!body.trim()) return { ok: false, error: 'empty body after generation' };

    // Auto-image
    let mediaUrl: string | null = null;
    let imageAssetId: string | null = null;
    if (opts.autoImage !== false) {
      try {
        const visualHint = imagePromptHint || (await this.images.refinePromptForPost(body, platform));
        const combinedPrompt = `${visualHint}\n\nPost context:\n${body}`;
        const size = platform === 'INSTAGRAM' ? '1024x1792' : platform === 'YOUTUBE' ? '1024x1792' : '1792x1024';
        const img = await this.images.generate({ prompt: combinedPrompt, size: size as any, platform, actorId: opts.actor });
        if (img?.ok && img.asset?.url) {
          mediaUrl = img.asset.url;
          imageAssetId = img.asset.id;
        }
      } catch (err: any) {
        this.log.warn(`quickDraft autoImage failed: ${err?.message || err}`);
      }
    }

    const finalBody = hashtags.length ? `${body}\n\n${hashtags.join(' ')}` : body;

    const post = await this.prisma.socialPost.create({
      data: {
        channel: platform as any,
        body: finalBody,
        mediaUrl,
        status: 'draft',
        sourceType: 'manual_topic',
        engagementStats: {
          autopilot: false,
          mix: 'topic',
          angle: 'topic',
          headline,
          topic,
          imageAssetId,
        } as any,
      } as any,
    });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        action: 'social.quick_draft',
        resourceType: 'social_post',
        resourceId: post.id,
        metadata: { platform, topic, mediaUrl: !!mediaUrl } as any,
      },
    });

    await this.events.publish({ eventType: 'AUTOPILOT_POST_DRAFTED', payload: { id: post.id, platform, mix: 'topic' } });

    return { ok: true, post: { id: post.id, channel: post.channel, body: finalBody, mediaUrl, status: post.status }, headline };
  }

  /**
   * Recent autopilot runs from AuditLog for the UI.
   */
  async recentRuns(limit = 10) {
    return this.prisma.auditLog.findMany({
      where: { action: 'social.autopilot.drafted' } as any,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 10, 50),
    });
  }
}
