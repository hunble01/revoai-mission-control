import { Controller, Get, Query, Req } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { assertAdminToken } from '../../common/auth.util';

@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Req() req: any, @Query('limit') limit?: string) {
    assertAdminToken(req);
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit || 200), 1000),
    });
  }
}
