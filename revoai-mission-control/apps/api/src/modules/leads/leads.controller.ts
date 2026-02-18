import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto, OverrideLeadScoreDto } from './dto/lead.dto';
import { assertAdminToken, assertAdminRole, getActorRole } from '../../common/auth.util';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list(@Req() req: any, @Query('search') search?: string, @Query('status') status?: string) {
    assertAdminToken(req);
    return this.leads.list({ search, status });
  }

  @Post()
  create(@Req() req: any, @Body() body: CreateLeadDto) {
    assertAdminToken(req);
    return this.leads.create(body);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    return this.leads.update(id, body);
  }

  @Post(':id/score-override')
  overrideScore(@Req() req: any, @Param('id') id: string, @Body() body: OverrideLeadScoreDto) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'lead score override');
    return this.leads.overrideScore(id, body.score, body.reason);
  }
}
