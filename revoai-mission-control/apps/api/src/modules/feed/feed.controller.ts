import { Controller, Get, Query, Req } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { assertAdminToken } from '../../common/auth.util';

@Controller()
export class FeedController {
  constructor(private readonly prisma: PrismaService) {}

  private async list(limit?: string) {
    const rows = await this.prisma.taskEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit || 100), 500),
    });
    return rows.map((r: any) => ({ ...r, payload: r?.payload ?? null, id: typeof r.id === 'bigint' ? Number(r.id) : r.id }));
  }

  @Get('events/feed')
  feed(@Req() req: any, @Query('limit') limit?: string) {
    assertAdminToken(req);
    return this.list(limit);
  }

  @Get('feed')
  feedAlias(@Req() req: any, @Query('limit') limit?: string) {
    assertAdminToken(req);
    return this.list(limit);
  }

  /**
   * Today's counts for each Live Agent card. Seeds the dashboard on
   * page load so counters reflect real activity even before any new
   * event arrives over the socket.
   */
  @Get('stats/agent-counts')
  async agentCounts(@Req() req: any) {
    assertAdminToken(req);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      researchLeadsToday,
      leadsEnrichedToday,
      draftsCreatedToday,
      sendsToday,
      followUpDraftsToday,
      deliveryEventsToday,
    ] = await Promise.all([
      // Discovery: research_leads discovered today
      this.prisma.researchLead.count({ where: { createdAt: { gte: todayStart } } }),
      // Enrichment: leads whose sourceDetail JSON shows today's enrichedAt
      this.prisma.lead.count({
        where: {
          updatedAt: { gte: todayStart },
          sourceDetail: { contains: 'enrichedAt' } as any,
        },
      }),
      // Drafter: drafts created today
      this.prisma.draft.count({ where: { createdAt: { gte: todayStart } } }),
      // Sender: sends today
      this.prisma.outboundSend.count({
        where: {
          sentAt: { gte: todayStart },
          status: { in: ['sent', 'delivered', 'opened', 'clicked', 'bounced'] as any },
        },
      }),
      // Follow-up: follow-up drafts generated today (draftType OUTREACH_FOLLOWUP)
      this.prisma.draft.count({
        where: {
          createdAt: { gte: todayStart },
          draftType: 'OUTREACH_FOLLOWUP' as any,
        },
      }).catch(() => 0),
      // Delivery tracker: OutboundSend rows whose status landed on a delivery event today
      this.prisma.outboundSend.count({
        where: {
          sentAt: { gte: todayStart },
          status: { in: ['delivered', 'opened', 'clicked', 'bounced', 'complained'] as any },
        },
      }),
    ]);

    return {
      discovery: researchLeadsToday,
      enrichment: leadsEnrichedToday,
      drafter: draftsCreatedToday,
      sender: sendsToday,
      followup: followUpDraftsToday,
      tracker: deliveryEventsToday,
      asOf: new Date().toISOString(),
    };
  }
}
