import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/campaign.dto';
import { assertAdminToken, assertAdminRole, getActorRole } from '../../common/auth.util';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

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
}
