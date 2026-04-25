import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { InstagramService } from './instagram.service';
import { SettingsService } from '../settings/settings.service';

@Controller('instagram')
export class InstagramController {
  constructor(private readonly instagram: InstagramService, private readonly settings: SettingsService) {}

  @Get('oauth-start')
  oauthStart(@Req() req: any) {
    assertAdminToken(req);
    return this.instagram.oauthStart();
  }

  @Get('callback')
  oauthCallback(@Query('code') code?: string, @Query('state') state?: string) {
    return this.instagram.oauthCallback(code || '', state || '');
  }

  @Get('status')
  status(@Req() req: any) {
    assertAdminToken(req);
    return this.instagram.status();
  }

  @Post('publish')
  async publish(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    await this.settings.assertOutboundAllowed('instagram');
    return this.instagram.publishApproved(body?.socialPostId);
  }

  @Get('insights')
  insights(@Req() req: any) {
    assertAdminToken(req);
    return this.instagram.insights();
  }
}
