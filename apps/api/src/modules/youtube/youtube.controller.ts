import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { YoutubeService } from './youtube.service';

@Controller('youtube')
export class YoutubeController {
  constructor(private readonly yt: YoutubeService) {}

  @Get('oauth-start')
  oauthStart(@Req() req: any) {
    assertAdminToken(req);
    return this.yt.oauthStart();
  }

  @Get('callback')
  oauthCallback(@Query('code') code?: string, @Query('state') state?: string) {
    return this.yt.oauthCallback(code || '', state || '');
  }

  @Get('status')
  status(@Req() req: any) {
    assertAdminToken(req);
    return this.yt.status();
  }

  @Get('stats')
  stats(@Req() req: any) {
    assertAdminToken(req);
    return this.yt.stats();
  }

  @Post('generate-idea')
  generateIdea(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    const format = String(body?.format || 'short').toLowerCase() === 'long' ? 'long' : 'short';
    return this.yt.generateVideoIdea(format as any);
  }
}
