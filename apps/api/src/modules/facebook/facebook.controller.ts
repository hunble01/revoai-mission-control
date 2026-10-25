import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { FacebookService } from './facebook.service';
import { SettingsService } from '../settings/settings.service';

@Controller('facebook')
export class FacebookController {
  constructor(private readonly facebook: FacebookService, private readonly settings: SettingsService) {}

  @Get('oauth-start')
  oauthStart(@Req() req: any) {
    assertAdminToken(req);
    return this.facebook.oauthStart();
  }

  @Get('callback')
  oauthCallback(@Query('code') code?: string, @Query('state') state?: string) {
    return this.facebook.oauthCallback(code || '', state || '');
  }

  @Get('status')
  status(@Req() req: any) {
    assertAdminToken(req);
    return this.facebook.status();
  }

  @Post('publish')
  async publish(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    await this.settings.assertOutboundAllowed('facebook');
    return this.facebook.publishApproved(body?.socialPostId || body?.draftId, body?.mode || 'socialPost');
  }

  @Get('insights')
  insights(@Req() req: any) {
    assertAdminToken(req);
    return this.facebook.insights();
  }
}
