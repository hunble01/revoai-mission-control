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
   * Rolling-24h counts for each Live Agent card. Seeds the dashboard on
   * page load so counters reflect real recent activity even before any
   * new event arrives over the socket.
   *
   * Why rolling-24h instead of calendar-today: the server runs in UTC
   * but users are in EDT. Counting "today" in UTC resets counters at
   * 8pm local time, which looks broken from the user's perspective.
   * Last-24h is timezone-agnostic and shows "recent activity" which
   * is the actual signal users care about.
   */
  @Get('stats/agent-counts')
  async agentCounts(@Req() req: any) {
    assertAdminToken(req);
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      researchLeadsRecent,
      leadsEnrichedRecent,
      draftsCreatedRecent,
      sendsRecent,
      followUpDraftsRecent,
      deliveryEventsRecent,
    ] = await Promise.all([
      this.prisma.researchLead.count({ where: { createdAt: { gte: windowStart } } }),
      this.prisma.lead.count({
        where: {
          updatedAt: { gte: windowStart },
          sourceDetail: { contains: 'enrichedAt' } as any,
        },
      }),
      this.prisma.draft.count({ where: { createdAt: { gte: windowStart } } }),
      this.prisma.outboundSend.count({
        where: {
          sentAt: { gte: windowStart },
          status: { in: ['sent', 'delivered', 'opened', 'clicked', 'bounced'] as any },
        },
      }),
      this.prisma.draft.count({
        where: {
          createdAt: { gte: windowStart },
          draftType: 'OUTREACH_FOLLOWUP' as any,
        },
      }).catch(() => 0),
      this.prisma.outboundSend.count({
        where: {
          sentAt: { gte: windowStart },
          status: { in: ['delivered', 'opened', 'clicked', 'bounced', 'complained'] as any },
        },
      }),
    ]);

    return {
      windowHours: 24,
      discovery: researchLeadsRecent,
      enrichment: leadsEnrichedRecent,
      drafter: draftsCreatedRecent,
      sender: sendsRecent,
      followup: followUpDraftsRecent,
      tracker: deliveryEventsRecent,
      asOf: new Date().toISOString(),
    };
  }
}
