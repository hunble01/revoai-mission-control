import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSafetyDto } from './dto/settings.dto';
import { assertAdminToken, assertAdminRole, getActorRole } from '../../common/auth.util';

@Controller('settings/safety')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  getSafety(@Req() req: any) {
    assertAdminToken(req);
    return this.settings.getSafety();
  }

  @Patch()
  patchSafety(@Req() req: any, @Body() body: UpdateSafetyDto) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'safety settings changes');
    return this.settings.updateSafety(body);
  }

  @Post('danger/clear-draft-queue')
  clearDraftQueue(@Req() req: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'danger clear draft queue');
    return this.settings.clearDraftQueue();
  }

  @Post('danger/reset-agent-states')
  resetAgentStates(@Req() req: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'danger reset agent states');
    return this.settings.resetAgentStates();
  }
}
