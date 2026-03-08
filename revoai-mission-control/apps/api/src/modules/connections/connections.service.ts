import { BadRequestException, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConnectionsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeProvider(input: string) {
    const p = String(input || '').toLowerCase();
    if (['email', 'facebook', 'instagram', 'linkedin'].includes(p)) return p;
    throw new BadRequestException({
      code: 'INVALID_PROVIDER',
      message: `Unsupported provider: ${input}`,
      details: { supported: ['email', 'facebook', 'instagram', 'linkedin'] },
    });
  }

  private toChannel(provider: string): 'EMAIL' | 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' {
    const p = this.normalizeProvider(provider);
    if (p === 'email') return 'EMAIL';
    if (p === 'facebook') return 'FACEBOOK';
    if (p === 'instagram') return 'INSTAGRAM';
    return 'LINKEDIN';
  }

  private emailOAuthConfig() {
    const clientId = process.env.EMAIL_OAUTH_CLIENT_ID || '';
    const clientSecret = process.env.EMAIL_OAUTH_CLIENT_SECRET || '';
    const authUrl = process.env.EMAIL_OAUTH_AUTH_URL || '';
    const tokenUrl = process.env.EMAIL_OAUTH_TOKEN_URL || '';
    const callbackUrl = process.env.EMAIL_OAUTH_CALLBACK_URL || '';
    const scopes = (process.env.EMAIL_OAUTH_SCOPES || 'openid profile email offline_access')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const configured = !!(clientId && clientSecret && authUrl && tokenUrl && callbackUrl);
    return { configured, clientId, clientSecret, authUrl, tokenUrl, callbackUrl, scopes };
  }

  private hashToken(value?: string | null) {
    if (!value) return null;
    return createHash('sha256').update(value).digest('hex');
  }

  private encryptSecret(value?: string | null) {
    if (!value) return null;
    const secret = createHash('sha256').update(process.env.SESSION_SECRET || process.env.ADMIN_TOKEN || 'change-me').digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', secret, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  private decryptSecret(value?: string | null) {
    if (!value) return null;
    const [ivB64, tagB64, dataB64] = String(value).split('.');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const secret = createHash('sha256').update(process.env.SESSION_SECRET || process.env.ADMIN_TOKEN || 'change-me').digest();
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const data = Buffer.from(dataB64, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', secret, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(data), decipher.final()]);
    return out.toString('utf8');
  }

  async startConnect(providerRaw: string, actorId?: string) {
    const provider = this.normalizeProvider(providerRaw);
    const appBase = process.env.PUBLIC_APP_BASE || process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
    const state = randomUUID();

    const localStub = String(process.env.OAUTH_STUB_MODE || '1') !== '0';
    let authUrl = `/api/connections/${provider}/oauth-start?state=${encodeURIComponent(state)}&appBase=${encodeURIComponent(appBase)}`;

    if (provider === 'email') {
      const cfg = this.emailOAuthConfig();
      if (!cfg.configured || localStub) {
        authUrl += '&stub=1';
      }
    } else if (localStub) {
      authUrl += '&stub=1';
    }

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: actorId || null,
        action: 'connection.connect.start',
        resourceType: 'connection',
        resourceId: provider,
        metadata: { provider, result: 'started' } as any,
      },
    });

    return {
      ok: true,
      provider,
      authUrl,
    };
  }

  async oauthStart(providerRaw: string, state?: string, appBase?: string, stub = true) {
    const provider = this.normalizeProvider(providerRaw);
    const webBase = appBase || process.env.PUBLIC_APP_BASE || process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
    const safeState = state || randomUUID();
    const apiBase = process.env.PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

    if (provider === 'email') {
      const cfg = this.emailOAuthConfig();
      const useStub = stub || !cfg.configured || String(process.env.OAUTH_STUB_MODE || '1') !== '0';

      if (useStub) {
        return {
          redirectUrl: `${apiBase}/api/connections/${provider}/callback?code=stub_code_email&state=${encodeURIComponent(
            safeState,
          )}&appBase=${encodeURIComponent(webBase)}&stub=1`,
        };
      }

      const query = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: cfg.callbackUrl,
        response_type: 'code',
        scope: cfg.scopes.join(' '),
        state: safeState,
      });

      return { redirectUrl: `${cfg.authUrl}?${query.toString()}` };
    }

    // Non-email providers remain stub-safe for this task scope.
    return {
      redirectUrl: `${apiBase}/api/connections/${provider}/callback?code=stub_code_${provider}&state=${encodeURIComponent(
        safeState,
      )}&appBase=${encodeURIComponent(webBase)}&stub=1`,
    };
  }

  async oauthCallback(providerRaw: string, code?: string, state?: string, appBase?: string, stub = true) {
    const provider = this.normalizeProvider(providerRaw);
    if (!code || !state) {
      throw new BadRequestException({
        code: 'OAUTH_CALLBACK_INVALID',
        message: 'Missing required callback parameters: code/state',
      });
    }

    const now = new Date();
    const channel = this.toChannel(provider);
    const webBase = appBase || process.env.PUBLIC_APP_BASE || process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';

    // Email real token exchange path
    if (provider === 'email') {
      const cfg = this.emailOAuthConfig();
      const useStub = stub || !cfg.configured || String(process.env.OAUTH_STUB_MODE || '1') !== '0';

      if (!useStub) {
        const form = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: cfg.callbackUrl,
        });

        const tokenRes = await fetch(cfg.tokenUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        });

        const tokenJson: any = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || !tokenJson?.access_token) {
          throw new BadRequestException({
            code: 'EMAIL_TOKEN_EXCHANGE_FAILED',
            message: 'Email token exchange failed',
          });
        }

        const accessTokenHash = this.hashToken(tokenJson.access_token);
        const refreshTokenHash = this.hashToken(tokenJson.refresh_token);
        const encryptedAccessToken = this.encryptSecret(tokenJson.access_token);
        const encryptedRefreshToken = this.encryptSecret(tokenJson.refresh_token);
        const expiresIn = Number(tokenJson.expires_in || 0) || null;

        await this.prisma.connection.upsert({
          where: { provider: channel },
          update: {
            status: 'CONNECTED',
            health: 'HEALTHY',
            accountId: tokenJson.user_id || tokenJson.email || 'email-account',
            scopes: (tokenJson.scope ? String(tokenJson.scope).split(' ') : cfg.scopes).filter(Boolean),
            tokenRef: accessTokenHash,
            tokenMeta: {
              mode: 'oauth',
              hasRefreshToken: !!refreshTokenHash,
              refreshTokenHash,
              accessTokenHash,
              encryptedAccessToken,
              encryptedRefreshToken,
              tokenType: tokenJson.token_type || null,
              expiresIn,
              obtainedAt: now.toISOString(),
            } as any,
            lastSyncAt: now,
            lastCheckedAt: now,
          },
          create: {
            provider: channel,
            status: 'CONNECTED',
            health: 'HEALTHY',
            accountId: tokenJson.user_id || tokenJson.email || 'email-account',
            scopes: (tokenJson.scope ? String(tokenJson.scope).split(' ') : cfg.scopes).filter(Boolean),
            tokenRef: accessTokenHash,
            tokenMeta: {
              mode: 'oauth',
              hasRefreshToken: !!refreshTokenHash,
              refreshTokenHash,
              accessTokenHash,
              encryptedAccessToken,
              encryptedRefreshToken,
              tokenType: tokenJson.token_type || null,
              expiresIn,
              obtainedAt: now.toISOString(),
            } as any,
            lastSyncAt: now,
            lastCheckedAt: now,
          },
        });

        return { ok: true, provider, redirectUrl: `${webBase}/connections?provider=${provider}&connected=1` };
      }
    }

    // Local/mock fallback mode
    const accountId = `${provider}_acct_${randomUUID().slice(0, 8)}`;
    const scopes = provider === 'email' ? ['send', 'read'] : ['basic', 'messages'];

    await this.prisma.connection.upsert({
      where: { provider: channel },
      update: {
        status: 'CONNECTED',
        health: 'HEALTHY',
        accountId,
        scopes,
        tokenRef: `stub_ref_${provider}_${randomUUID().slice(0, 12)}`,
        tokenMeta: {
          mode: 'stub',
          codePresent: true,
          statePresent: true,
          updatedAt: now.toISOString(),
        } as any,
        lastSyncAt: now,
        lastCheckedAt: now,
      },
      create: {
        provider: channel,
        status: 'CONNECTED',
        health: 'HEALTHY',
        accountId,
        scopes,
        tokenRef: `stub_ref_${provider}_${randomUUID().slice(0, 12)}`,
        tokenMeta: {
          mode: 'stub',
          codePresent: true,
          statePresent: true,
          createdAt: now.toISOString(),
        } as any,
        lastSyncAt: now,
        lastCheckedAt: now,
      },
    });

    return { ok: true, provider, redirectUrl: `${webBase}/connections?provider=${provider}&connected=1` };
  }

  async list() {
    const rows = await this.prisma.connection.findMany({
      orderBy: { provider: 'asc' },
    });

    const providers = rows.map((r) => String(r.provider));
    const sends = await this.prisma.outboundSend.findMany({ where: { provider: { in: providers as any } as any }, orderBy: { sentAt: 'desc' }, take: 500 }).catch(() => [] as any[]);
    const tokenRows = await this.prisma.providerToken.findMany({ where: { provider: { in: providers.map((p) => p.toLowerCase()) } } }).catch(() => [] as any[]);
    const tokenByProvider = new Map<string, any>();
    for (const t of tokenRows as any[]) tokenByProvider.set(String(t.provider).toUpperCase(), t);

    return rows.map((r) => {
      const provider = String(r.provider || '').toUpperCase();
      const providerSends = sends.filter((s: any) => String(s.provider || '').toUpperCase() === provider);
      const sentCount = providerSends.filter((s: any) => String(s.status || '').toLowerCase() === 'sent').length;
      const failCount = providerSends.length - sentCount;
      const errorRate = providerSends.length ? Math.round((failCount / providerSends.length) * 100) : 0;
      const lastSuccess = providerSends.find((s: any) => String(s.status || '').toLowerCase() === 'sent') || null;

      const now = Date.now();
      const tokenRow: any = tokenByProvider.get(provider);
      const expiresAt = tokenRow?.expiresAt || null;
      const expiresInSec = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000)) : null;
      const quotaMax = provider === 'LINKEDIN' ? 20 : provider === 'EMAIL' ? 500 : 100;
      const quotaUsed = providerSends.filter((s: any) => s.sentAt && new Date(s.sentAt).toDateString() === new Date().toDateString()).length;

      return {
        id: r.id,
        provider: r.provider,
        status: r.status,
        health: r.health,
        accountId: r.accountId,
        scopes: r.scopes,
        tokenMeta: {
          hasToken: !!r.tokenRef,
          mode: (r.tokenMeta as any)?.mode || null,
          hasRefreshToken: !!(r.tokenMeta as any)?.hasRefreshToken,
          tokenType: (r.tokenMeta as any)?.tokenType || null,
          expiresIn: (r.tokenMeta as any)?.expiresIn || null,
          obtainedAt: (r.tokenMeta as any)?.obtainedAt || null,
          lastTest: (r.tokenMeta as any)?.lastTest || null,
          lastTestResult: (r.tokenMeta as any)?.lastTestResult || null,
          expiresAt,
          expiresInSec,
        },
        metrics: {
          quotaUsed,
          quotaMax,
          errorRate,
          lastSuccessfulSendAt: lastSuccess?.sentAt || null,
        },
        lastSyncAt: r.lastSyncAt,
        lastCheckedAt: r.lastCheckedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
  }

  async disconnect(providerRaw: string, actorId?: string) {
    const provider = this.normalizeProvider(providerRaw);
    const channel = this.toChannel(provider);

    const existing = await this.prisma.connection.findUnique({ where: { provider: channel } });
    if (!existing) {
      await this.prisma.auditLog.create({
        data: {
          actorType: 'user',
          actorId: actorId || null,
          action: 'connection.disconnect',
          resourceType: 'connection',
          resourceId: provider,
          metadata: { provider, result: 'already_disconnected' } as any,
        },
      });
      return {
        ok: true,
        provider,
        status: 'NOT_CONNECTED',
        health: 'DEGRADED',
        alreadyDisconnected: true,
      };
    }

    const updated = await this.prisma.connection.update({
      where: { provider: channel },
      data: {
        status: 'NOT_CONNECTED',
        health: 'DEGRADED',
        accountId: null,
        scopes: [],
        tokenRef: null,
        tokenMeta: { hasToken: false, disconnectedAt: new Date().toISOString() } as any,
        lastSyncAt: null,
        lastCheckedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: actorId || null,
        action: 'connection.disconnect',
        resourceType: 'connection',
        resourceId: provider,
        metadata: { provider, result: 'disconnected' } as any,
      },
    });

    return {
      ok: true,
      provider,
      status: updated.status,
      health: updated.health,
      alreadyDisconnected: false,
    };
  }

  async testConnection(providerRaw: string, actorId?: string) {
    const provider = this.normalizeProvider(providerRaw);
    const channel = this.toChannel(provider);
    const now = new Date();

    const existing = await this.prisma.connection.findUnique({ where: { provider: channel } });
    if (!existing || existing.status !== 'CONNECTED') {
      const row = await this.prisma.connection.upsert({
        where: { provider: channel },
        update: {
          status: existing?.status || 'NOT_CONNECTED',
          health: 'FAILED',
          lastCheckedAt: now,
          tokenMeta: {
            ...(typeof existing?.tokenMeta === 'object' && existing?.tokenMeta ? existing.tokenMeta : {}),
            lastTest: now.toISOString(),
            lastTestResult: 'not_connected',
          } as any,
        },
        create: {
          provider: channel,
          status: 'NOT_CONNECTED',
          health: 'FAILED',
          tokenMeta: { lastTest: now.toISOString(), lastTestResult: 'not_connected' } as any,
          lastCheckedAt: now,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          actorType: 'user',
          actorId: actorId || null,
          action: 'connection.test',
          resourceType: 'connection',
          resourceId: provider,
          metadata: { provider, result: 'not_connected', health: row.health } as any,
        },
      });

      return { ok: true, provider, status: row.status, health: row.health, message: 'Provider not connected' };
    }

    let healthy = true;
    let testResult: string = 'ok';

    if (provider === 'email') {
      const stubMode = String(process.env.OAUTH_STUB_MODE || '1') !== '0';
      const validateUrl = process.env.EMAIL_PROVIDER_VALIDATE_URL || '';
      const encryptedAccessToken = (existing.tokenMeta as any)?.encryptedAccessToken || null;
      const accessToken = this.decryptSecret(encryptedAccessToken);

      if (!stubMode && validateUrl && accessToken) {
        try {
          const res = await fetch(validateUrl, {
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          });
          healthy = res.ok;
          testResult = res.ok ? 'ok' : `provider_http_${res.status}`;
        } catch {
          healthy = false;
          testResult = 'provider_unreachable';
        }
      } else if (!stubMode) {
        healthy = false;
        testResult = 'missing_validate_config_or_token';
      }
    }

    const updated = await this.prisma.connection.update({
      where: { provider: channel },
      data: {
        health: healthy ? 'HEALTHY' : 'DEGRADED',
        lastCheckedAt: now,
        tokenMeta: {
          ...(typeof existing.tokenMeta === 'object' && existing.tokenMeta ? existing.tokenMeta : {}),
          lastTest: now.toISOString(),
          lastTestResult: testResult,
        } as any,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: actorId || null,
        action: 'connection.test',
        resourceType: 'connection',
        resourceId: provider,
        metadata: { provider, result: 'ok', health: updated.health } as any,
      },
    });

    return { ok: true, provider, status: updated.status, health: updated.health, lastCheckedAt: updated.lastCheckedAt };
  }
}
