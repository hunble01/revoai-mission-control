import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

type Role = 'admin' | 'operator' | 'closer' | 'viewer';

type SessionPayload = {
  sid: string;
  uid: string;
  role: Role;
  exp: number;
};

function secret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_TOKEN || 'change-me';
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

function decodeSessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed?.uid || !parsed?.role || !parsed?.exp) return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readSessionCookie(req: any) {
  const cookieHeader = String(req?.headers?.cookie || '');
  const part = cookieHeader
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith('mc_session='));
  if (!part) return null;
  return part.slice('mc_session='.length);
}

function authFromRequest(req: any): SessionPayload | null {
  const cookieToken = readSessionCookie(req);
  return decodeSessionToken(cookieToken);
}

export function assertAdminToken(req: any) {
  const auth = authFromRequest(req);
  if (!auth) throw new UnauthorizedException('Not authenticated');
  req.auth = auth;
}

export function getActorRole(req: any): Role {
  const auth = req?.auth || authFromRequest(req);
  if (!auth) return 'viewer';
  return auth.role;
}

export function assertAdminRole(role: string, action = 'this action') {
  if (role !== 'admin') throw new ForbiddenException(`Admin required for ${action}`);
}
