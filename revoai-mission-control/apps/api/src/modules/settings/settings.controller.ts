import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSafetyDto } from './dto/settings.dto';
import { assertAdminRole, assertAdminToken, getActorRole } from '../../common/auth.util';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  getSettings(@Req() req: any) {
    assertAdminToken(req);
    return this.settings.getSafety();
  }

  @Get('safety')
  getSafety(@Req() req: any) {
    assertAdminToken(req);
    return this.settings.getSafety();
  }

  @Patch()
  patchSettings(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'settings patch');
    return this.settings.updateSafety(body);
  }

  @Get('brand')
  getBrand(@Req() req: any) {
    assertAdminToken(req);
    return this.settings.getBrand();
  }

  @Post('brand')
  saveBrand(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'settings brand save');
    return this.settings.saveBrand(body);
  }

  @Patch('safety')
  patchSafety(@Req() req: any, @Body() body: UpdateSafetyDto) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'settings safety patch');
    return this.settings.updateSafety(body);
  }

  @Post('safety/danger/clear-draft-queue')
  clearDraftQueue(@Req() req: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'clear draft queue');
    return this.settings.clearDraftQueue();
  }

  @Post('safety/danger/reset-agent-states')
  resetAgentStates(@Req() req: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'reset agent states');
    return this.settings.resetAgentStates();
  }
}
