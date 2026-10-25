import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

// Instagram posting goes through the Meta Graph API and requires an Instagram
// Business or Creator account linked to a Facebook Page. OAuth + token shape
// mirror the Facebook module exactly; only the publish flow differs (IG is a
// 2-step container/publish dance and requires a media URL).

@Injectable()
export class InstagramService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  private key() {
    const seed = String(process.env.INSTAGRAM_TOKEN_SECRET || process.env.SECRET_KEY || 'revoai-instagram-dev-secret');
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
    const authUrl = process.env.INSTAGRAM_AUTH_URL || 'https://www.facebook.com/v18.0/dialog/oauth';
    const clientId = process.env.INSTAGRAM_CLIENT_ID || process.env.FACEBOOK_CLIENT_ID || '';
    const callback = process.env.INSTAGRAM_CALLBACK_URL || `${process.env.PUBLIC_API_BASE || 'http://localhost:3001'}/api/instagram/callback`;
    const scope = encodeURIComponent(process.env.INSTAGRAM_SCOPES || 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement');
    const state = randomBytes(8).toString('hex');
    if (!clientId) throw new BadRequestException('Missing INSTAGRAM_CLIENT_ID');
    return { authUrl: `${authUrl}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callback)}&state=${state}&scope=${scope}&response_type=code` };
  }

  async oauthCallback(code: string, _state: string) {
    if (!code) throw new BadRequestException('Missing code');

    const stub = String(process.env.INSTAGRAM_STUB_MODE || '1') !== '0';
    let accessToken = `ig_stub_token_${Date.now()}`;
    let expiresAt: Date | null = new Date(Date.now() + 60 * 24 * 3600 * 1000);

    if (!stub) {
      const tokenUrl = process.env.INSTAGRAM_TOKEN_URL || 'https://graph.facebook.com/v18.0/oauth/access_token';
      const clientId = process.env.INSTAGRAM_CLIENT_ID || process.env.FACEBOOK_CLIENT_ID || '';
      const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET || process.env.FACEBOOK_CLIENT_SECRET || '';
      const callback = process.env.INSTAGRAM_CALLBACK_URL || `${process.env.PUBLIC_API_BASE || 'http://localhost:3001'}/api/instagram/callback`;
      if (!clientId || !clientSecret) throw new BadRequestException('Missing Instagram OAuth credentials');

      const query = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callback,
        code,
      });
      const res = await fetch(`${tokenUrl}?${query.toString()}`);
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok || !j?.access_token) throw new BadRequestException(j?.error?.message || `Instagram token exchange failed (${res.status})`);
      accessToken = j.access_token;
      expiresAt = j.expires_in ? new Date(Date.now() + Number(j.expires_in) * 1000) : expiresAt;
    }

    await this.prisma.providerToken.upsert({
      where: { provider: 'instagram' },
      create: {
        provider: 'instagram',
        accessToken: this.encrypt(accessToken),
        expiresAt,
        scope: process.env.INSTAGRAM_SCOPES || null,
      },
      update: {
        accessToken: this.encrypt(accessToken),
        expiresAt,
        scope: process.env.INSTAGRAM_SCOPES || null,
      },
    });

    return { ok: true, provider: 'instagram', connected: true, expiresAt };
  }

  async status() {
    const token = await this.prisma.providerToken.findUnique({ where: { provider: 'instagram' } });
    const now = Date.now();
    const expiresInSec = token?.expiresAt ? Math.max(0, Math.floor((new Date(token.expiresAt).getTime() - now) / 1000)) : null;
    return { connected: !!token, expiresAt: token?.expiresAt || null, expiresInSec };
  }

  async publishApproved(id: string) {
    if (!id) throw new BadRequestException('socialPostId required');

    const tokenRow = await this.prisma.providerToken.findUnique({ where: { provider: 'instagram' } });
    if (!tokenRow) throw new BadRequestException('Instagram not connected');
    const accessToken = this.decrypt(tokenRow.accessToken);
    if (!accessToken) throw new BadRequestException('Instagram token unavailable');

    const post = await this.prisma.socialPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Social post not found');
    if (String(post.channel) !== 'INSTAGRAM') throw new BadRequestException('Not an Instagram social post');
    if (!['approved', 'scheduled'].includes(String(post.status))) throw new BadRequestException('Social post must be approved/scheduled');

    const caption = post.body;
    const mediaUrl = post.mediaUrl || '';
    if (!caption) throw new BadRequestException('Caption is empty');

    const stub = String(process.env.INSTAGRAM_PUBLISH_STUB_MODE || '1') !== '0';
    let externalPostId = `ig_post_stub_${Date.now()}`;

    if (!stub) {
      // IG real publish requires a media URL. Reels/photo only.
      if (!mediaUrl) throw new BadRequestException('Instagram requires a mediaUrl (image or video URL)');

      const igAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '';
      if (!igAccountId) throw new BadRequestException('Missing INSTAGRAM_BUSINESS_ACCOUNT_ID');

      // Step 1: create media container
      const containerUrl = `https://graph.facebook.com/v18.0/${igAccountId}/media`;
      const containerBody = new URLSearchParams({
        image_url: mediaUrl,
        caption,
        access_token: accessToken,
      });
      const containerRes = await fetch(containerUrl, { method: 'POST', body: containerBody });
      const containerJson: any = await containerRes.json().catch(() => ({}));
      if (!containerRes.ok || !containerJson?.id) {
        throw new BadRequestException(containerJson?.error?.message || `Instagram container creation failed (${containerRes.status})`);
      }
      const creationId = containerJson.id;

      // Step 2: publish container
      const publishUrl = `https://graph.facebook.com/v18.0/${igAccountId}/media_publish`;
      const publishBody = new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken,
      });
      const publishRes = await fetch(publishUrl, { method: 'POST', body: publishBody });
      const publishJson: any = await publishRes.json().catch(() => ({}));
      if (!publishRes.ok || !publishJson?.id) {
        throw new BadRequestException(publishJson?.error?.message || `Instagram publish failed (${publishRes.status})`);
      }
      externalPostId = publishJson.id;
    }

    await this.prisma.socialPost.update({
      where: { id },
      data: { status: 'posted', postedAt: new Date(), externalPostId },
    });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        action: 'instagram.publish',
        resourceType: 'social_post',
        resourceId: id,
        metadata: { externalPostId, stub } as any,
      },
    });

    await this.events.publish({ eventType: 'POST_PUBLISHED', payload: { id, channel: 'INSTAGRAM' } });
    return { ok: true, externalPostId };
  }

  async insights() {
    const stub = String(process.env.INSTAGRAM_INSIGHTS_STUB_MODE || '1') !== '0';
    if (stub) {
      return {
        reach: 480,
        impressions: 1820,
        engagement: 64,
        followersDelta: 7,
      };
    }

    const tokenRow = await this.prisma.providerToken.findUnique({ where: { provider: 'instagram' } });
    const accessToken = this.decrypt(tokenRow?.accessToken || null);
    const igAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '';
    if (!accessToken || !igAccountId) throw new BadRequestException('Instagram insights config missing');

    const url = `https://graph.facebook.com/v18.0/${igAccountId}/insights?metric=reach,impressions,follower_count&period=day&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new BadRequestException(j?.error?.message || `Instagram insights failed (${res.status})`);

    return { raw: j };
  }
}
