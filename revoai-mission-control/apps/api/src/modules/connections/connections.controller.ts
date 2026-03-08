import { Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { ConnectionsService } from './connections.service';

@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  list(@Req() req: any) {
    assertAdminToken(req);
    return this.connections.list();
  }

  @Post(':provider/connect')
  connect(@Req() req: any, @Param('provider') provider: string) {
    assertAdminToken(req);
    return this.connections.startConnect(provider, req?.auth?.uid);
  }

  @Post(':provider/disconnect')
  disconnect(@Req() req: any, @Param('provider') provider: string) {
    assertAdminToken(req);
    return this.connections.disconnect(provider, req?.auth?.uid);
  }

  @Post(':provider/test')
  test(@Req() req: any, @Param('provider') provider: string) {
    assertAdminToken(req);
    return this.connections.testConnection(provider, req?.auth?.uid);
  }

  @Get(':provider/oauth-start')
  async oauthStart(
    @Req() req: any,
    @Res() res: any,
    @Param('provider') provider: string,
    @Query('state') state?: string,
    @Query('appBase') appBase?: string,
    @Query('stub') stub?: string,
  ) {
    // keep callback route usable in local mode even without session for testing redirect path
    const out = await this.connections.oauthStart(provider, state, appBase, stub === '1');
    return res.redirect(out.redirectUrl);
  }

  @Get(':provider/callback')
  async callback(
    @Req() req: any,
    @Res() res: any,
    @Param('provider') provider: string,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('appBase') appBase?: string,
    @Query('stub') stub?: string,
  ) {
    try {
      const out = await this.connections.oauthCallback(provider, code, state, appBase, stub === '1');
      return res.redirect(out.redirectUrl);
    } catch {
      const webBase = appBase || process.env.PUBLIC_APP_BASE || process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
      return res.redirect(`${webBase}/connections?provider=${provider}&connected=0`);
    }
  }
}
