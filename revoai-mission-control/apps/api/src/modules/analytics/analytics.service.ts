import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async funnel() {
    // "Researched" = any lead we've discovered (top of funnel). Autorun
    // promotes leads with status='APPROVED' not 'RESEARCHED', so counting
    // by that one status returned 0 even when we had 40+ leads. Use total
    // leads minus terminal-failure states instead — that matches user
    // intuition of "how many leads are in my database".
    const [total, contacted, replied, booked, closed] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.lead.count({ where: { status: 'CONTACTED' } as any }),
      this.prisma.lead.count({ where: { status: 'REPLIED' } as any }),
      this.prisma.lead.count({ where: { status: 'BOOKED' } as any }),
      this.prisma.lead.count({ where: { status: 'LOST' } as any }),
    ]);
    return { researched: total, contacted, replied, booked, closed };
  }

  async channels() {
    const sends = await this.prisma.outboundSend.findMany({ orderBy: { sentAt: 'desc' }, take: 1000 });
    const linkedin = await this.prisma.linkedinMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 });

    const map: Record<string, { sent: number; replied: number }> = {
      EMAIL: { sent: 0, replied: 0 },
      LINKEDIN: { sent: 0, replied: 0 },
      FACEBOOK: { sent: 0, replied: 0 },
    };

    for (const s of sends as any[]) {
      const p = String(s.provider || '').toUpperCase();
      if (!map[p]) map[p] = { sent: 0, replied: 0 };
      if (String(s.status || '').toLowerCase() === 'sent') map[p].sent += 1;
    }

    for (const m of linkedin as any[]) {
      if (String(m.status || '').toLowerCase() === 'sent') map.LINKEDIN.sent += 1;
      if (m.replyReceivedAt) map.LINKEDIN.replied += 1;
    }

    return map;
  }

  async contentPerformance() {
    const posts = await this.prisma.socialPost.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 });
    return posts.map((p: any) => ({
      id: p.id,
      channel: p.channel,
      status: p.status,
      postedAt: p.postedAt,
      bodyPreview: String(p.body || '').slice(0, 120),
      engagement: p.engagementStats || {},
    }));
  }

  async dailyActivity(days = 14) {
    const n = Math.max(1, Math.min(days, 90));
    const now = new Date();
    const out: any[] = [];

    for (let i = n - 1; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);

      const [sends, replies, bookings] = await Promise.all([
        this.prisma.outboundSend.count({ where: { sentAt: { gte: start, lt: end }, status: 'sent' } as any }),
        this.prisma.lead.count({ where: { status: 'REPLIED', lastActionAt: { gte: start, lt: end } } as any }),
        this.prisma.lead.count({ where: { status: 'BOOKED', lastActionAt: { gte: start, lt: end } } as any }),
      ]);

      out.push({ date: start.toISOString().slice(0, 10), sends, replies, bookings });
    }

    return out;
  }

  async exportCsv() {
    const [f, c, daily] = await Promise.all([this.funnel(), this.channels(), this.dailyActivity(14)]);
    const lines = [
      'section,key,value',
      `funnel,researched,${f.researched}`,
      `funnel,contacted,${f.contacted}`,
      `funnel,replied,${f.replied}`,
      `funnel,booked,${f.booked}`,
      `funnel,closed,${f.closed}`,
      `channels,email_sent,${c.EMAIL?.sent || 0}`,
      `channels,linkedin_sent,${c.LINKEDIN?.sent || 0}`,
      `channels,facebook_sent,${c.FACEBOOK?.sent || 0}`,
      ...daily.map((d) => `daily,${d.date},sends:${d.sends}|replies:${d.replies}|bookings:${d.bookings}`),
    ];
    return { filename: `analytics-${new Date().toISOString().slice(0, 10)}.csv`, csv: lines.join('\n') };
  }
}
