import { UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

type Role = 'admin' | 'operator' | 'closer' | 'viewer';

const SESSION_COOKIE = 'mc_session';

const roleRank: Record<Role, number> = {
  viewer: 1,
  closer: 2,
  operator: 3,
  admin: 4,
};

type SessionPayload = {
  sid: string;
  uid: string;
  role: Role;
  exp: number;
};

function sessionSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_TOKEN || 'change-me';
}

function readSessionCookie(req: any): string | null {
  const raw = String(req?.headers?.cookie || '');
  if (!raw) return null;
  const hit = raw
    .split(';')
    .map((p: string) => p.trim())
    .find((p: string) => p.startsWith(`${SESSION_COOKIE}=`));
  if (!hit) return null;
  return hit.slice(SESSION_COOKIE.length + 1) || null;
}

function decodeSession(token: string | null): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;

  const expected = createHmac('sha256', sessionSecret()).update(body).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed?.sid || !parsed?.uid || !parsed?.role || !parsed?.exp) return null;
    if (Date.now() > parsed.exp) return null;
    if (!['admin', 'operator', 'closer', 'viewer'].includes(parsed.role)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function adminTokenValid(req: any): boolean {
  const expected = String(process.env.ADMIN_TOKEN || '').trim();
  const provided = String(req?.headers?.['x-admin-token'] || '').trim();
  if (!expected || !provided) return false;
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export function assertAdminToken(req: any) {
  const session = decodeSession(readSessionCookie(req));
  if (session) {
    req.auth = { uid: session.uid, role: session.role, via: 'session' };
    return;
  }

  if (adminTokenValid(req)) {
    req.auth = { uid: 'system', role: 'admin', via: 'token' };
    return;
  }

  throw new UnauthorizedException('Authentication required');
}

export function getActorRole(req: any): Role {
  return (req?.auth?.role || 'viewer') as Role;
}

export function assertAdminRole(role: string, action = 'this action') {
  const normalized = (String(role || 'viewer').toLowerCase() as Role);
  if ((roleRank[normalized] || 0) < roleRank.operator) {
    throw new UnauthorizedException(`Insufficient role for ${action}`);
  }
  return true;
}
