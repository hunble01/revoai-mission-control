import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { ResearchService } from './research.service';

@Controller('research')
export class ResearchController {
  constructor(private readonly research: ResearchService) {}

  @Post('run')
  run(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    return this.research.run(body || {});
  }

  @Post('runs')
  runV2(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    return this.research.run(body || {});
  }

  @Get('runs')
  runs(@Req() req: any) {
    assertAdminToken(req);
    return this.research.listRuns();
  }

  @Get('runs/:id/leads')
  leads(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.research.getLeads(id);
  }

  @Get('runs/:id/content')
  content(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.research.getContent(id);
  }

  @Get('runs/:id/intel')
  intel(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.research.getIntel(id);
  }

  @Get('runs/:id/status')
  runStatus(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.research.runStatus(id);
  }

  @Post('runs/:id/export-leads')
  exportLeads(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    return this.research.exportLeads(id, body?.campaignId);
  }

  @Post('competitor-intel')
  competitorIntelRun(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    return this.research.runCompetitorIntel(body?.competitorId, body?.competitor || null);
  }

  @Get('competitor-intel/:competitorId')
  competitorIntelGet(@Req() req: any, @Param('competitorId') competitorId: string) {
    assertAdminToken(req);
    return this.research.getCompetitorIntel(competitorId);
  }
}
