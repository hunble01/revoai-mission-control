import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('events')
export class FeedController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('feed')
  async feed(@Query('limit') limit?: string) {
    return this.prisma.taskEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit || 100), 500),
    });
  }
}
