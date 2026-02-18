import { Controller, Get, Query, Req } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { assertAdminToken } from '../../common/auth.util';

@Controller('events')
export class FeedController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('feed')
  async feed(@Req() req: any, @Query('limit') limit?: string) {
    assertAdminToken(req);
    return this.prisma.taskEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit || 100), 500),
    });
  }
}
