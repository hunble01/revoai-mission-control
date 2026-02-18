import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
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
}
