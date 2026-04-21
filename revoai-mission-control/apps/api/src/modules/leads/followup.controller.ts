import { Controller, Post, Get, Req, Param, Body } from '@nestjs/common';
import { FollowUpService } from './followup.service';
import { assertAdminToken, assertAdminRole, getActorRole } from '../../common/auth.util';

@Controller('followup')
export class FollowUpController {
  constructor(private readonly svc: FollowUpService) {}

  @Post('run')
  async run(@Req() req: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'follow-up run');
    return this.svc.runCycle();
  }

  @Post('lead/:id/pause')
  async pause(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'follow-up pause');
    const reason = (body?.reason || 'manual') as any;
    await this.svc.pauseSequence(id, reason);
    return { ok: true };
  }
}
