import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

const SESSION_COOKIE = 'mc_session';
const SESSION_DAYS = 7;

type SessionPayload = {
  sid: string;
  uid: string;
  role: 'admin' | 'operator' | 'closer' | 'viewer';
  exp: number;
};

function dbRoleToSessionRole(role: string): 'admin' | 'operator' | 'closer' | 'viewer' {
  const v = String(role || '').toUpperCase();
  if (v === 'ADMIN') return 'admin';
  if (v === 'OPERATOR') return 'operator';
  if (v === 'CLOSER') return 'closer';
  return 'viewer';
}

function sessionRoleToDbRole(role: string): 'ADMIN' | 'OPERATOR' | 'CLOSER' | 'VIEWER' {
  const v = String(role || '').toLowerCase();
  if (v === 'admin') return 'ADMIN';
  if (v === 'operator') return 'OPERATOR';
  if (v === 'closer') return 'CLOSER';
  return 'VIEWER';
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  sessionCookieName() {
    return SESSION_COOKIE;
  }

  private secret() {
    return process.env.SESSION_SECRET || process.env.ADMIN_TOKEN || 'change-me';
  }

  private async hashPassword(raw: string): Promise<string> {
    return bcrypt.hash(raw, BCRYPT_ROUNDS);
  }

  private legacyHash(raw: string): string {
    const salt = process.env.PASSWORD_SALT || 'revoai';
    return createHash('sha256').update(`${salt}:${raw}`).digest('hex');
  }

  private async verifyPassword(raw: string, stored: string): Promise<{ ok: boolean; needsRehash: boolean }> {
    if (stored.startsWith('$2')) {
      const ok = await bcrypt.compare(raw, stored);
      return { ok, needsRehash: false };
    }
    const expected = this.legacyHash(raw);
    const a = Buffer.from(expected);
    const b = Buffer.from(stored);
    if (a.length !== b.length) return { ok: false, needsRehash: false };
    const ok = timingSafeEqual(a, b);
    return { ok, needsRehash: ok };
  }

  private sign(payload: string) {
    return createHmac('sha256', this.secret()).update(payload).digest('hex');
  }

  private encodeSession(payload: SessionPayload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = this.sign(body);
    return `${body}.${sig}`;
  }

  decodeSession(token?: string | null): SessionPayload | null {
    if (!token) return null;
    const [body, sig] = String(token).split('.');
    if (!body || !sig) return null;

    const expected = this.sign(body);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    try {
      const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
      if (!parsed?.sid || !parsed?.uid || !parsed?.role || !parsed?.exp) return null;
      if (Date.now() > parsed.exp) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  cookieHeader(value: string, expiresAt: Date) {
    const override = (process.env.COOKIE_SECURE || '').trim().toLowerCase();
    const secure = override === 'true' ? true : override === 'false' ? false : process.env.NODE_ENV === 'production';
    return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}; ${secure ? 'Secure;' : ''}`;
  }

  clearCookieHeader() {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(0).toUTCString()};`;
  }

  async bootstrapAdmin() {
    const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = (process.env.BOOTSTRAP_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();
    if (!email || !password) {
      throw new BadRequestException('Missing bootstrap admin credentials in environment');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { ok: true, created: false, email };
    }

    await this.prisma.user.create({
      data: {
        email,
        passwordHash: await this.hashPassword(password),
        role: 'ADMIN',
        isActive: true,
      },
    });

    return { ok: true, created: true, email };
  }

  async login(emailRaw: string, passwordRaw: string, ip?: string, userAgent?: string) {
    const email = String(emailRaw || '').trim().toLowerCase();
    const password = String(passwordRaw || '');

    if (!email || !password) throw new UnauthorizedException('Invalid credentials');

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const { ok, needsRehash } = await this.verifyPassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    if (needsRehash) {
      const rehashed = await this.hashPassword(password);
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: rehashed } });
    }

    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        role: user.role,
        expiresAt,
        ip: ip || null,
        userAgent: userAgent || null,
      },
    });

    const token = this.encodeSession({ sid: session.id, uid: user.id, role: dbRoleToSessionRole(user.role), exp: expiresAt.getTime() });
    return {
      token,
      expiresAt,
      user: { id: user.id, email: user.email, role: dbRoleToSessionRole(user.role) },
    };
  }

  async logout(sessionId?: string) {
    if (!sessionId) return;
    await this.prisma.session.updateMany({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  }

  async me(session: SessionPayload | null) {
    if (!session) return null;
    const row = await this.prisma.session.findFirst({
      where: {
        id: session.sid,
        userId: session.uid,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!row || !row.user?.isActive) return null;
    return { id: row.user.id, email: row.user.email, role: row.user.role, expiresAt: row.expiresAt };
  }
}
