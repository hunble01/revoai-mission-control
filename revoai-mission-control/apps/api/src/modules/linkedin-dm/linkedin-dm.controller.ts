import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { LinkedinDmService } from './linkedin-dm.service';

@Controller('linkedin-dm')
export class LinkedinDmController {
  constructor(private readonly dm: LinkedinDmService) {}

  @Get('queue')
  queue(@Req() req: any) {
    assertAdminToken(req);
    return this.dm.queue();
  }

  @Get('history')
  history(@Req() req: any) {
    assertAdminToken(req);
    return this.dm.history();
  }

  @Post('queue')
  enqueue(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    return this.dm.enqueue(body);
  }

  @Post(':id/send')
  send(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.dm.send(id);
  }

  @Post(':id/reject')
  reject(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.dm.reject(id);
  }
}
