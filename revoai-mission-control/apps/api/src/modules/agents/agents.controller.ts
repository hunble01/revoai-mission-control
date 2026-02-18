import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { assertAdminToken } from '../../common/auth.util';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  list(@Req() req: any) {
    assertAdminToken(req);
    return this.agents.list();
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    return this.agents.update(id, body);
  }
}
