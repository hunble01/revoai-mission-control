import { Controller, Get, Query, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('funnel')
  funnel(@Req() req: any) {
    assertAdminToken(req);
    return this.analytics.funnel();
  }

  @Get('channels')
  channels(@Req() req: any) {
    assertAdminToken(req);
    return this.analytics.channels();
  }

  @Get('content-performance')
  contentPerformance(@Req() req: any) {
    assertAdminToken(req);
    return this.analytics.contentPerformance();
  }

  @Get('daily-activity')
  dailyActivity(@Req() req: any, @Query('days') days?: string) {
    assertAdminToken(req);
    return this.analytics.dailyActivity(Number(days) || 14);
  }

  @Get('export.csv')
  async exportCsv(@Req() req: any) {
    assertAdminToken(req);
    return this.analytics.exportCsv();
  }
}
