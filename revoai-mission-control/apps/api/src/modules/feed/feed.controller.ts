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
}
