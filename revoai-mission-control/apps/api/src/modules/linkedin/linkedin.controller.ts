import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { LinkedinService } from './linkedin.service';

@Controller('linkedin')
export class LinkedinController {
  constructor(private readonly linkedin: LinkedinService) {}

  @Get('oauth-start')
  oauthStart(@Req() req: any) {
    assertAdminToken(req);
    return this.linkedin.oauthStart();
  }

  @Get('callback')
  oauthCallback(@Query('code') code?: string, @Query('state') state?: string) {
    return this.linkedin.oauthCallback(code || '', state || '');
  }

  @Get('status')
  status(@Req() req: any) {
    assertAdminToken(req);
    return this.linkedin.status();
  }

  @Post('post')
  post(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    return this.linkedin.postApproved(body?.socialPostId);
  }
}
