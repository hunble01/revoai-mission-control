import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async find(q: string) {
    const query = q.trim();
    if (!query) return { leads: [], drafts: [], campaigns: [] };

    const [leads, drafts, campaigns] = await Promise.all([
      this.prisma.lead.findMany({ where: { OR: [{ businessName: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } }] }, take: 8 }),
      this.prisma.draft.findMany({ where: { OR: [{ draftType: { contains: query, mode: 'insensitive' } }, { channel: { equals: query.toUpperCase() as any } }] }, take: 8 }),
      this.prisma.campaign.findMany({ where: { OR: [{ name: { contains: query, mode: 'insensitive' } }, { niche: { contains: query, mode: 'insensitive' } }] }, take: 8 }),
    ]);

    return { leads, drafts, campaigns };
  }

  async notifications() {
    const approvals = await this.prisma.draft.count({ where: { status: 'NEEDS_APPROVAL' } as any });
    const failedSends = await this.prisma.outboundSend.count({ where: { status: { not: 'sent' } } as any }).catch(() => 0);
    const latestResearch = await this.prisma.researchRun.findFirst({ orderBy: { createdAt: 'desc' } }).catch(() => null);

    return {
      items: [
        { type: 'approvals_waiting', label: `${approvals} approvals waiting`, count: approvals },
        { type: 'research_latest', label: latestResearch ? `Research ${latestResearch.status} (${new Date(latestResearch.createdAt).toLocaleString()})` : 'No research run yet' },
        { type: 'send_failures', label: `${failedSends} send failures`, count: failedSends },
      ],
    };
  }
}
