import { Controller, Get, Post, Query, Req, Res, Body } from '@nestjs/common';
import { UnsubscribeService } from './unsubscribe.service';
import { assertAdminToken, assertAdminRole, getActorRole } from '../../common/auth.util';

@Controller()
export class UnsubscribeController {
  constructor(private readonly svc: UnsubscribeService) {}

  @Get('unsubscribe')
  async unsub(@Query('e') email: string, @Query('t') token: string, @Res() res: any) {
    try {
      await this.svc.handleUnsubscribe(email, token);
      res.status(200).type('html').send(this.successPage(email));
    } catch (err: any) {
      res.status(400).type('html').send(this.failurePage(err?.message || 'Invalid link'));
    }
  }

  @Get('suppressions')
  async list(@Req() req: any, @Query('limit') limit?: string) {
    assertAdminToken(req);
    return this.svc.list(Number(limit || 500));
  }

  @Post('suppressions')
  async add(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'suppression list write');
    return this.svc.suppress(body?.email, body?.reason || 'MANUAL', body?.source || 'admin', body?.note, body?.campaignId);
  }

  private successPage(email: string): string {
    const safe = String(email || '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c] as string);
    return `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:24px;color:#222}h1{font-size:20px}p{color:#555;line-height:1.5}</style></head><body><h1>You've been unsubscribed</h1><p><strong>${safe}</strong> will no longer receive messages from this sender.</p><p>If this was a mistake, reply to any previous message and we'll add you back manually.</p></body></html>`;
  }

  private failurePage(msg: string): string {
    const safe = String(msg).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] as string);
    return `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribe failed</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:24px;color:#222}</style></head><body><h1>We couldn't process that link</h1><p>${safe}</p><p>Reply to the email you received and we'll remove you manually.</p></body></html>`;
  }
}
