import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignAutorunService } from './campaign-autorun.service';
import { CreateCampaignDto } from './dto/campaign.dto';
import { assertAdminToken, assertAdminRole, getActorRole } from '../../common/auth.util';

@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly autorun: CampaignAutorunService,
  ) {}

  private guard(req: any, mutating = false) {
    assertAdminToken(req);
    if (mutating) assertAdminRole(getActorRole(req), 'campaigns write');
  }

  @Get()
  list(@Req() req: any) {
    this.guard(req);
    return this.campaigns.list();
  }

  @Post()
  create(@Req() req: any, @Body() body: CreateCampaignDto) {
    this.guard(req, true);
    return this.campaigns.create(body);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.guard(req, true);
    return this.campaigns.update(id, body);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    this.guard(req, true);
    return this.campaigns.remove(id);
  }

  @Post(':id/clone')
  clone(@Req() req: any, @Param('id') id: string) {
    this.guard(req, true);
    return this.campaigns.clone(id);
  }

  @Post(':id/upload')
  upload(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.guard(req, true);
    return this.campaigns.upload(id, body);
  }

  /**
   * One-button autonomous campaign runner.
   * Fires research → promote → enrich → draft as a background job and
   * returns immediately with a correlation ID. Watch /feed for progress.
   */
  @Post(':id/autorun')
  async autoRun(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.guard(req, true);
    const runId = this.autorun.startFullRun(id, {
      maxLeads: Number(body?.maxLeads) || undefined,
      enrichLimit: Number(body?.enrichLimit) || undefined,
    });
    return { ok: true, runId, message: 'Autorun started. Watch /feed for progress or poll /api/campaigns/autorun/:runId' };
  }

  @Get('autorun/:runId')
  async autoRunStatus(@Req() req: any, @Param('runId') runId: string) {
    this.guard(req);
    return this.autorun.getStatus(runId) || { ok: false, error: 'Run not found or expired' };
  }
}
