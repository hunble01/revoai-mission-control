import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/campaign.dto';
import { assertAdminToken } from '../../common/auth.util';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list(@Req() req: any) {
    assertAdminToken(req);
    return this.campaigns.list();
  }

  @Post()
  create(@Req() req: any, @Body() body: CreateCampaignDto) {
    assertAdminToken(req);
    return this.campaigns.create(body);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    return this.campaigns.update(id, body);
  }
}
