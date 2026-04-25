import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { MetaDmService } from './meta-dm.service';

@Controller('meta-dm')
export class MetaDmController {
  constructor(private readonly meta: MetaDmService) {}

  @Get('queue')
  queue(@Req() req: any, @Query('channel') channel?: string) {
    assertAdminToken(req);
    return this.meta.queue(channel);
  }

  @Get('history')
  history(@Req() req: any, @Query('channel') channel?: string) {
    assertAdminToken(req);
    return this.meta.history(channel);
  }

  @Post('queue')
  enqueue(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    return this.meta.enqueue(body);
  }

  @Post(':id/approve')
  approve(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.meta.approve(id);
  }

  @Post(':id/reject')
  reject(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    return this.meta.reject(id, body?.reason);
  }

  @Post(':id/send')
  send(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.meta.send(id);
  }
}
