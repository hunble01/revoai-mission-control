import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { assertAdminToken, assertAdminRole, getActorRole } from '../../common/auth.util';
import { SocialAutopilotService } from './social-autopilot.service';

@Controller('social-autopilot')
export class SocialAutopilotController {
  constructor(private readonly svc: SocialAutopilotService) {}

  @Get('status')
  status(@Req() req: any) {
    assertAdminToken(req);
    return this.svc.status();
  }

  @Post('config')
  setConfig(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'autopilot config update');
    return this.svc.setConfig(body || {});
  }

  @Post('run-now')
  runNow(@Req() req: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'autopilot run-now');
    const actorId = req?.headers?.['x-actor-id'] ? String(req.headers['x-actor-id']) : 'manual';
    return this.svc.runOnce(actorId);
  }

  @Post('quick-draft')
  quickDraft(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'autopilot quick-draft');
    const actorId = req?.headers?.['x-actor-id'] ? String(req.headers['x-actor-id']) : 'manual';
    return this.svc.quickDraft({
      topic: String(body?.topic || ''),
      platform: String(body?.platform || 'LINKEDIN').toUpperCase() as any,
      autoImage: body?.autoImage !== false,
      actor: actorId,
    });
  }

  @Get('recent')
  recent(@Req() req: any, @Query('limit') limit?: string) {
    assertAdminToken(req);
    return this.svc.recentRuns(limit ? Number(limit) : 10);
  }
}
