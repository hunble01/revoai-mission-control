import { BadRequestException, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';

// YouTube — Wave 3 minimal scaffolding.
// What's wired:
//   - OAuth scaffolding (Google Cloud / youtube.readonly scope)
//   - Token storage in provider_tokens (provider='youtube'), AES-256-GCM
//   - Read-only channel stats (subscribers, views, video count)
//   - Video idea generator: Claude returns hook/script/title/thumbnail/b-roll/music
// What's intentionally NOT wired (per Wave 3 plan):
//   - Video upload — requires AI video gen budget approval
//   - YouTube comments / community-post writes
// Stub mode is on by default. The user records videos themselves from the
// generated script.

const VIDEO_IDEA_PROMPT = `You are a short-form video strategist for RevoAI, an AI receptionist for local service businesses ($97/mo CAD, 10-min setup).

Generate ONE high-leverage YouTube Short or Long-form idea. Return STRICT JSON:
{
  "format": "short" | "long",
  "hook": "<first 3 seconds — must stop the scroll>",
  "title": "<title 50-70 chars, no clickbait, no ALL CAPS>",
  "script": "<full script 60-180 sec for short, 4-8 min for long. Plain text, line-broken between beats. Include HOOK / PROBLEM / TURN / CTA structure>",
  "thumbnail_concept": "<one sentence describing the thumbnail composition: subject, expression, text overlay, color palette>",
  "b_roll_suggestions": ["<3-6 specific b-roll shots that would cut between talking-head moments>"],
  "music_vibe": "<one phrase, e.g. 'upbeat lofi', 'tense edm build', 'warm acoustic'>",
  "end_cta": "<single sentence CTA pointing at revoai.ca/sign-up — soft, not begging>"
}

Voice rules:
- Founder-tone, conversational, NO buzzwords (revolutionize / synergy / seamless).
- NO em-dashes.
- One soft CTA only — no ALL CAPS, no clickbait.
- Use concrete numbers and outcomes where possible.
- DON'T include any field outside the schema.`;

@Injectable()
export class YoutubeService {
  constructor(private readonly prisma: PrismaService) {}

  private key() {
    const seed = String(process.env.YOUTUBE_TOKEN_SECRET || process.env.SECRET_KEY || 'revoai-youtube-dev-secret');
    return createHash('sha256').update(seed).digest();
  }

  private encrypt(raw: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}.${tag.toString('hex')}.${encrypted.toString('hex')}`;
  }

  private decrypt(payload?: string | null) {
    if (!payload) return null;
    try {
      const [ivHex, tagHex, dataHex] = String(payload).split('.');
      const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }

  oauthStart() {
    const authUrl = process.env.YOUTUBE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
    const clientId = process.env.YOUTUBE_CLIENT_ID || '';
    const callback = process.env.YOUTUBE_CALLBACK_URL || `${process.env.PUBLIC_API_BASE || 'http://localhost:3001'}/api/youtube/callback`;
    const scope = encodeURIComponent(process.env.YOUTUBE_SCOPES || 'https://www.googleapis.com/auth/youtube.readonly');
    const state = randomBytes(8).toString('hex');
    if (!clientId) throw new BadRequestException('Missing YOUTUBE_CLIENT_ID');
    return {
      authUrl: `${authUrl}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callback)}&response_type=code&access_type=offline&prompt=consent&scope=${scope}&state=${state}`,
    };
  }

  async oauthCallback(code: string, _state: string) {
    if (!code) throw new BadRequestException('Missing code');

    const stub = String(process.env.YOUTUBE_STUB_MODE || '1') !== '0';
    let accessToken = `yt_stub_token_${Date.now()}`;
    let refreshToken: string | null = `yt_stub_refresh_${Date.now()}`;
    let expiresAt: Date | null = new Date(Date.now() + 60 * 24 * 3600 * 1000);

    if (!stub) {
      const tokenUrl = process.env.YOUTUBE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
      const clientId = process.env.YOUTUBE_CLIENT_ID || '';
      const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || '';
      const callback = process.env.YOUTUBE_CALLBACK_URL || `${process.env.PUBLIC_API_BASE || 'http://localhost:3001'}/api/youtube/callback`;
      if (!clientId || !clientSecret) throw new BadRequestException('Missing YouTube OAuth credentials');

      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callback,
        code,
        grant_type: 'authorization_code',
      });
      const res = await fetch(tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok || !j?.access_token) throw new BadRequestException(j?.error_description || `YouTube token exchange failed (${res.status})`);
      accessToken = j.access_token;
      refreshToken = j.refresh_token || null;
      expiresAt = j.expires_in ? new Date(Date.now() + Number(j.expires_in) * 1000) : expiresAt;
    }

    await this.prisma.providerToken.upsert({
      where: { provider: 'youtube' },
      create: {
        provider: 'youtube',
        accessToken: this.encrypt(accessToken),
        refreshToken: refreshToken ? this.encrypt(refreshToken) : null,
        expiresAt,
        scope: process.env.YOUTUBE_SCOPES || null,
      },
      update: {
        accessToken: this.encrypt(accessToken),
        refreshToken: refreshToken ? this.encrypt(refreshToken) : null,
        expiresAt,
        scope: process.env.YOUTUBE_SCOPES || null,
      },
    });

    return { ok: true, provider: 'youtube', connected: true, expiresAt };
  }

  async status() {
    const token = await this.prisma.providerToken.findUnique({ where: { provider: 'youtube' } });
    const now = Date.now();
    const expiresInSec = token?.expiresAt ? Math.max(0, Math.floor((new Date(token.expiresAt).getTime() - now) / 1000)) : null;
    return { connected: !!token, expiresAt: token?.expiresAt || null, expiresInSec };
  }

  async stats() {
    const stub = String(process.env.YOUTUBE_STATS_STUB_MODE || '1') !== '0';
    if (stub) {
      return {
        subscriberCount: 0,
        viewCount: 0,
        videoCount: 0,
        recentVideos: [],
        stub: true,
      };
    }

    const tokenRow = await this.prisma.providerToken.findUnique({ where: { provider: 'youtube' } });
    const accessToken = this.decrypt(tokenRow?.accessToken || null);
    if (!accessToken) throw new BadRequestException('YouTube not connected');

    const url = 'https://youtube.googleapis.com/youtube/v3/channels?part=statistics,snippet&mine=true';
    const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new BadRequestException(j?.error?.message || `YouTube stats failed (${res.status})`);

    const ch = j?.items?.[0];
    return {
      subscriberCount: Number(ch?.statistics?.subscriberCount || 0),
      viewCount: Number(ch?.statistics?.viewCount || 0),
      videoCount: Number(ch?.statistics?.videoCount || 0),
      title: ch?.snippet?.title || '',
      recentVideos: [],
      stub: false,
    };
  }

  /**
   * Generate a YouTube Short or Long-form video idea: hook + script +
   * title + thumbnail concept + B-roll suggestions + music vibe + CTA.
   * Saves to ContentIdea so it appears alongside the social post ideas
   * with contentType='youtube_short' or 'youtube_long'.
   */
  async generateVideoIdea(format: 'short' | 'long' = 'short') {
    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (!apiKey) throw new BadRequestException('ANTHROPIC_API_KEY not configured');
    const model = (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim();

    try {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model,
        max_tokens: 1500,
        system: VIDEO_IDEA_PROMPT,
        messages: [{ role: 'user', content: `Format: ${format}. Return the JSON now.` }],
      });
      const raw = (resp.content || [])
        .map((b: any) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim()
        .replace(/^```json\s*/, '')
        .replace(/```\s*$/, '')
        .trim();
      const parsed = JSON.parse(raw);

      // Persist as a ContentIdea row so it appears in the calendar Ideas tab
      const idea = await this.prisma.contentIdea.create({
        data: {
          platform: 'YOUTUBE_SHORT',
          headline: String(parsed?.title || parsed?.hook || 'YouTube idea').slice(0, 200),
          source: 'Original',
          contentType: format === 'short' ? 'youtube_short' : 'youtube_long',
          angle: String(parsed?.hook || '').slice(0, 300),
          aiDraft: JSON.stringify({
            hook: parsed?.hook || '',
            title: parsed?.title || '',
            script: parsed?.script || '',
            thumbnail_concept: parsed?.thumbnail_concept || '',
            b_roll_suggestions: Array.isArray(parsed?.b_roll_suggestions) ? parsed.b_roll_suggestions : [],
            music_vibe: parsed?.music_vibe || '',
            end_cta: parsed?.end_cta || '',
          }).slice(0, 4000),
        } as any,
      });

      return { ok: true, idea, parsed };
    } catch (err: any) {
      throw new BadRequestException(`YouTube idea generation failed: ${err?.message || err}`);
    }
  }
}
