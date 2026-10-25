import { BadRequestException, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UnsubscribeService {
  constructor(private readonly prisma: PrismaService) {}

  private secret() {
    return process.env.SESSION_SECRET || process.env.SECRET_KEY || 'change-me';
  }

  private tokenFor(email: string): string {
    const normalized = String(email || '').trim().toLowerCase();
    return createHmac('sha256', this.secret()).update(`unsub:${normalized}`).digest('hex');
  }

  private verifyToken(email: string, token: string): boolean {
    const expected = this.tokenFor(email);
    const a = Buffer.from(expected);
    const b = Buffer.from(String(token || ''));
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  publicUrlBase(): string {
    return (process.env.PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '');
  }

  buildUnsubscribeUrl(email: string): string {
    const token = this.tokenFor(email);
    const e = encodeURIComponent(String(email || '').trim().toLowerCase());
    return `${this.publicUrlBase()}/api/unsubscribe?e=${e}&t=${token}`;
  }

  async isSuppressed(email: string): Promise<boolean> {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return false;
    const hit = await this.prisma.emailSuppression.findUnique({ where: { email: e } });
    return !!hit;
  }

  async suppress(email: string, reason: string, source?: string, note?: string, campaignId?: string) {
    const e = String(email || '').trim().toLowerCase();
    if (!e) throw new BadRequestException('email required');
    return this.prisma.emailSuppression.upsert({
      where: { email: e },
      update: { reason, source: source || null, note: note || null, campaignId: campaignId || null },
      create: { email: e, reason, source: source || null, note: note || null, campaignId: campaignId || null },
    });
  }

  async handleUnsubscribe(email: string, token: string) {
    const e = String(email || '').trim().toLowerCase();
    if (!e || !token) throw new BadRequestException('invalid unsubscribe link');
    if (!this.verifyToken(e, token)) throw new BadRequestException('invalid unsubscribe link');
    await this.suppress(e, 'UNSUBSCRIBE', 'link');
    return { ok: true, email: e };
  }

  async list(limit = 500) {
    return this.prisma.emailSuppression.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 500, 2000),
    });
  }

  appendFooter(body: string, email: string): string {
    const url = this.buildUnsubscribeUrl(email);
    if (body.includes(url)) return body;
    const footer = `\n\n---\nIf you no longer wish to receive these messages, unsubscribe here: ${url}`;
    return body + footer;
  }
}
