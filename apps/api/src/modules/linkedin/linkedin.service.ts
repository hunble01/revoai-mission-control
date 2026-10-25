import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class LinkedinService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  private key() {
    const seed = String(process.env.LINKEDIN_TOKEN_SECRET || process.env.SECRET_KEY || 'revoai-linkedin-dev-secret');
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
    const authUrl = process.env.LINKEDIN_AUTH_URL || 'https://www.linkedin.com/oauth/v2/authorization';
    const clientId = process.env.LINKEDIN_CLIENT_ID || '';
    const callback = process.env.LINKEDIN_CALLBACK_URL || `${process.env.PUBLIC_API_BASE || 'http://localhost:3001'}/api/linkedin/callback`;
    const scope = encodeURIComponent(process.env.LINKEDIN_SCOPES || 'w_member_social r_liteprofile r_emailaddress');
    const state = randomBytes(8).toString('hex');
    if (!clientId) throw new BadRequestException('Missing LINKEDIN_CLIENT_ID');
    return { authUrl: `${authUrl}?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callback)}&state=${state}&scope=${scope}` };
  }

  async oauthCallback(code: string, _state: string) {
    if (!code) throw new BadRequestException('Missing code');
    const tokenUrl = process.env.LINKEDIN_TOKEN_URL || 'https://www.linkedin.com/oauth/v2/accessToken';
    const clientId = process.env.LINKEDIN_CLIENT_ID || '';
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
    const callback = process.env.LINKEDIN_CALLBACK_URL || `${process.env.PUBLIC_API_BASE || 'http://localhost:3001'}/api/linkedin/callback`;

    if (!clientId || !clientSecret) throw new BadRequestException('Missing LinkedIn OAuth credentials');

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callback,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json?.access_token) throw new BadRequestException(json?.error_description || `LinkedIn token exchange failed (${res.status})`);

    const expiresAt = json?.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000) : null;

    await this.prisma.providerToken.upsert({
      where: { provider: 'linkedin' },
      create: {
        provider: 'linkedin',
        accessToken: this.encrypt(json.access_token),
        refreshToken: json.refresh_token ? this.encrypt(json.refresh_token) : null,
        expiresAt,
        scope: json.scope || null,
      },
      update: {
        accessToken: this.encrypt(json.access_token),
        refreshToken: json.refresh_token ? this.encrypt(json.refresh_token) : null,
        expiresAt,
        scope: json.scope || null,
      },
    });

    return { ok: true, provider: 'linkedin', connected: true, expiresAt };
  }

  async status() {
    const token = await this.prisma.providerToken.findUnique({ where: { provider: 'linkedin' } });
    const now = Date.now();
    const expiresInSec = token?.expiresAt ? Math.max(0, Math.floor((new Date(token.expiresAt).getTime() - now) / 1000)) : null;
    return {
      connected: !!token,
      expiresAt: token?.expiresAt || null,
      expiresInSec,
    };
  }

  async postApproved(socialPostId?: string) {
    if (!socialPostId) throw new BadRequestException('socialPostId required');
    const post = await this.prisma.socialPost.findUnique({ where: { id: socialPostId } });
    if (!post) throw new NotFoundException('Social post not found');
    if (String(post.channel) !== 'LINKEDIN') throw new BadRequestException('Not a LinkedIn post');
    if (!['approved', 'scheduled'].includes(String(post.status))) throw new BadRequestException('Post must be approved or scheduled');

    const tokenRow = await this.prisma.providerToken.findUnique({ where: { provider: 'linkedin' } });
    if (!tokenRow) throw new BadRequestException('LinkedIn not connected');
    const accessToken = this.decrypt(tokenRow.accessToken);
    if (!accessToken) throw new BadRequestException('LinkedIn token unavailable');

    const stub = String(process.env.LINKEDIN_STUB_MODE || '1') !== '0';
    let externalPostId = `li_stub_${Date.now()}`;

    if (!stub) {
      const author = process.env.LINKEDIN_AUTHOR_URN || '';
      if (!author) throw new BadRequestException('Missing LINKEDIN_AUTHOR_URN');
      const url = process.env.LINKEDIN_SHARE_URL || 'https://api.linkedin.com/v2/ugcPosts';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'x-restli-protocol-version': '2.0.0',
        },
        body: JSON.stringify({
          author,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: post.body },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        }),
      });
      const js: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new BadRequestException(js?.message || `LinkedIn publish failed (${res.status})`);
      externalPostId = js?.id || externalPostId;
    }

    const updated = await this.prisma.socialPost.update({
      where: { id: socialPostId },
      data: {
        status: 'posted',
        postedAt: new Date(),
        externalPostId,
      },
    });

    await this.events.publish({ eventType: 'POST_PUBLISHED', payload: { socialPostId, channel: 'LINKEDIN' } });
    return { ok: true, id: updated.id, externalPostId };
  }
}
