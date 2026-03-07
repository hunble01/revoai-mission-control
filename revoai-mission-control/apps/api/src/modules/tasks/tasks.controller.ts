import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { assertAdminToken, assertAdminRole, getActorRole } from '../../common/auth.util';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@Req() req: any) {
    assertAdminToken(req);
    return this.tasks.list();
  }

  @Post()
  create(@Req() req: any, @Body() body: CreateTaskDto) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'task create');
    return this.tasks.create(body);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: UpdateTaskDto) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'task update');
    return this.tasks.update(id, body, getActorRole(req));
  }

  @Get(':id/replay')
  replay(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'task replay');
    return this.tasks.replay(id);
  }
}
