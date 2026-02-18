import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list() {
    return this.leads.list();
  }

  @Post()
  create(@Body() body: any) {
    return this.leads.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.leads.update(id, body);
  }

  @Post(':id/score-override')
  overrideScore(@Param('id') id: string, @Body() body: any) {
    return this.leads.overrideScore(id, body.score, body.reason);
  }
}
