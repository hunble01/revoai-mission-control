import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  list() {
    return this.agents.list();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.agents.update(id, body);
  }
}
