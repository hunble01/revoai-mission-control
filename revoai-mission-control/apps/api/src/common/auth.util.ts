import { UnauthorizedException } from '@nestjs/common';

type Role = 'admin' | 'operator' | 'closer' | 'viewer';

const roleRank: Record<Role, number> = {
  viewer: 1,
  closer: 2,
  operator: 3,
  admin: 4,
};

export function assertAdminToken(req: any) {
  const expected = String(process.env.ADMIN_TOKEN || 'change-me').trim();
  const provided = String(req?.headers?.['x-admin-token'] || '').trim();
  if (!provided || provided !== expected) {
    throw new UnauthorizedException('Invalid admin token');
  }

  const headerRole = String(req?.headers?.['x-actor-role'] || 'admin').toLowerCase();
  const role = (['admin', 'operator', 'closer', 'viewer'].includes(headerRole) ? headerRole : 'admin') as Role;
  const uid = String(req?.headers?.['x-actor-id'] || 'local');
  req.auth = { uid, role };
}

export function getActorRole(req: any): Role {
  return (req?.auth?.role || 'admin') as Role;
}

export function assertAdminRole(role: string, action = 'this action') {
  const normalized = (String(role || 'viewer').toLowerCase() as Role);
  if ((roleRank[normalized] || 0) < roleRank.operator) {
    throw new UnauthorizedException(`Insufficient role for ${action}`);
  }
  return true;
}
