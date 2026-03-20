import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class FacebookService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  private key() {
    const seed = String(process.env.FACEBOOK_TOKEN_SECRET || process.env.SECRET_KEY || 'revoai-facebook-dev-secret');
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
    const authUrl = process.env.FACEBOOK_AUTH_URL || 'https://www.facebook.com/v18.0/dialog/oauth';
    const clientId = process.env.FACEBOOK_CLIENT_ID || '';
    const callback = process.env.FACEBOOK_CALLBACK_URL || `${process.env.PUBLIC_API_BASE || 'http://localhost:3001'}/api/facebook/callback`;
    const scope = encodeURIComponent(process.env.FACEBOOK_SCOPES || 'pages_manage_posts,pages_read_engagement,pages_show_list');
    const state = randomBytes(8).toString('hex');
    if (!clientId) throw new BadRequestException('Missing FACEBOOK_CLIENT_ID');
    return { authUrl: `${authUrl}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callback)}&state=${state}&scope=${scope}&response_type=code` };
  }

  async oauthCallback(code: string, _state: string) {
    if (!code) throw new BadRequestException('Missing code');

    const stub = String(process.env.FACEBOOK_STUB_MODE || '1') !== '0';
    let accessToken = `fb_stub_token_${Date.now()}`;
    let expiresAt: Date | null = new Date(Date.now() + 60 * 24 * 3600 * 1000);

    if (!stub) {
      const tokenUrl = process.env.FACEBOOK_TOKEN_URL || 'https://graph.facebook.com/v18.0/oauth/access_token';
      const clientId = process.env.FACEBOOK_CLIENT_ID || '';
      const clientSecret = process.env.FACEBOOK_CLIENT_SECRET || '';
      const callback = process.env.FACEBOOK_CALLBACK_URL || `${process.env.PUBLIC_API_BASE || 'http://localhost:3001'}/api/facebook/callback`;
      if (!clientId || !clientSecret) throw new BadRequestException('Missing Facebook OAuth credentials');

      const query = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callback,
        code,
      });
      const res = await fetch(`${tokenUrl}?${query.toString()}`);
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok || !j?.access_token) throw new BadRequestException(j?.error?.message || `Facebook token exchange failed (${res.status})`);
      accessToken = j.access_token;
      expiresAt = j.expires_in ? new Date(Date.now() + Number(j.expires_in) * 1000) : expiresAt;
    }

    await this.prisma.providerToken.upsert({
      where: { provider: 'facebook' },
      create: {
        provider: 'facebook',
        accessToken: this.encrypt(accessToken),
        expiresAt,
        scope: process.env.FACEBOOK_SCOPES || null,
      },
      update: {
        accessToken: this.encrypt(accessToken),
        expiresAt,
        scope: process.env.FACEBOOK_SCOPES || null,
      },
    });

    return { ok: true, provider: 'facebook', connected: true, expiresAt };
  }

  async status() {
    const token = await this.prisma.providerToken.findUnique({ where: { provider: 'facebook' } });
    const now = Date.now();
    const expiresInSec = token?.expiresAt ? Math.max(0, Math.floor((new Date(token.expiresAt).getTime() - now) / 1000)) : null;
    return { connected: !!token, expiresAt: token?.expiresAt || null, expiresInSec };
  }

  async publishApproved(id: string, mode: 'socialPost' | 'draft' = 'socialPost') {
    if (!id) throw new BadRequestException('id required');

    const tokenRow = await this.prisma.providerToken.findUnique({ where: { provider: 'facebook' } });
    if (!tokenRow) throw new BadRequestException('Facebook not connected');
    const accessToken = this.decrypt(tokenRow.accessToken);
    if (!accessToken) throw new BadRequestException('Facebook token unavailable');

    let message = '';
    let campaignId: string | null = null;
    if (mode === 'socialPost') {
      const post = await this.prisma.socialPost.findUnique({ where: { id } });
      if (!post) throw new NotFoundException('Social post not found');
      if (String(post.channel) !== 'FACEBOOK') throw new BadRequestException('Not a Facebook social post');
      if (!['approved', 'scheduled'].includes(String(post.status))) throw new BadRequestException('Social post must be approved/scheduled');
      message = post.body;
    } else {
      const draft = await this.prisma.draft.findUnique({ where: { id } });
      if (!draft) throw new NotFoundException('Draft not found');
      if (String(draft.channel) !== 'FACEBOOK') throw new BadRequestException('Not a Facebook draft');
      if (String(draft.status) !== 'APPROVED') throw new BadRequestException('Draft must be approved');
      campaignId = draft.campaignId;
      const version = await this.prisma.draftVersion.findFirst({ where: { draftId: draft.id, versionNumber: draft.currentVersion } });
      message = String(version?.content || '').trim();
    }

    if (!message) throw new BadRequestException('Content is empty');

    const stub = String(process.env.FACEBOOK_PUBLISH_STUB_MODE || '1') !== '0';
    let externalPostId = `fb_post_stub_${Date.now()}`;

    if (!stub) {
      const pageId = process.env.FACEBOOK_PAGE_ID || '';
      if (!pageId) throw new BadRequestException('Missing FACEBOOK_PAGE_ID');
      const url = process.env.FACEBOOK_FEED_URL || `https://graph.facebook.com/v18.0/${pageId}/feed`;
      const body = new URLSearchParams({ message, access_token: accessToken });
      const res = await fetch(url, { method: 'POST', body });
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok || !j?.id) throw new BadRequestException(j?.error?.message || `Facebook publish failed (${res.status})`);
      externalPostId = j.id;
    }

    if (mode === 'socialPost') {
      await this.prisma.socialPost.update({ where: { id }, data: { status: 'posted', postedAt: new Date(), externalPostId } });
    } else {
      await this.prisma.outboundSend.create({ data: { provider: 'FACEBOOK', draftId: id, status: 'sent', externalMessageId: externalPostId, sentAt: new Date() } as any });
    }

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        action: 'facebook.publish',
        resourceType: mode === 'socialPost' ? 'social_post' : 'draft',
        resourceId: id,
        metadata: { mode, externalPostId } as any,
      },
    });

    await this.events.publish({ eventType: 'POST_PUBLISHED', campaignId, payload: { id, channel: 'FACEBOOK', mode } });
    return { ok: true, externalPostId };
  }

  async insights() {
    const stub = String(process.env.FACEBOOK_INSIGHTS_STUB_MODE || '1') !== '0';
    if (stub) {
      return {
        reach: 1200,
        engagement: 83,
        followersDelta: 12,
      };
    }

    const tokenRow = await this.prisma.providerToken.findUnique({ where: { provider: 'facebook' } });
    const accessToken = this.decrypt(tokenRow?.accessToken || null);
    const pageId = process.env.FACEBOOK_PAGE_ID || '';
    if (!accessToken || !pageId) throw new BadRequestException('Facebook insights config missing');

    const url = `https://graph.facebook.com/v18.0/${pageId}/insights?metric=page_impressions,page_engaged_users,page_fans&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new BadRequestException(j?.error?.message || `Facebook insights failed (${res.status})`);

    return { raw: j };
  }
}
