import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { TrendsService } from './trends.service';

@Controller('trends')
export class TrendsController {
  constructor(private readonly trends: TrendsService) {}

  @Get()
  list(@Req() req: any, @Query('source') source?: string, @Query('limit') limit?: string) {
    assertAdminToken(req);
    return this.trends.list(source, limit ? Number(limit) : 50);
  }

  @Post('refresh')
  refresh(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    return this.trends.refresh(body?.niche ? String(body.niche) : undefined);
  }

  @Delete(':id')
  dismiss(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.trends.dismiss(id);
  }

  @Post(':id/draft-post')
  draftPost(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    return this.trends.draftPostFromTrend(id, String(body?.channel || 'LINKEDIN'));
  }
}
