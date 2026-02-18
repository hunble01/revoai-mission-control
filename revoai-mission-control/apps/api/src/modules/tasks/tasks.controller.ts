import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list() {
    return this.tasks.list();
  }

  @Post()
  create(@Body() body: any) {
    return this.tasks.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.tasks.update(id, body);
  }

  @Get(':id/replay')
  replay(@Param('id') id: string) {
    return this.tasks.replay(id);
  }
}
