import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

export function assertAdminToken(req: any) {
  const required = process.env.ADMIN_TOKEN || process.env.ADMIN_PASSWORD;
  const provided = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
  if (!required) return;
  if (!provided || provided !== required) {
    throw new UnauthorizedException('Invalid admin token');
  }
}

export function getActorRole(req: any): 'admin' | 'operator' | 'closer' | 'viewer' {
  const v = String(req.headers['x-actor-role'] || 'admin').toLowerCase();
  if (v === 'admin' || v === 'operator' || v === 'closer' || v === 'viewer') return v;
  return 'admin';
}

export function assertAdminRole(role: string, action = 'this action') {
  if (role !== 'admin') throw new ForbiddenException(`Admin required for ${action}`);
}
