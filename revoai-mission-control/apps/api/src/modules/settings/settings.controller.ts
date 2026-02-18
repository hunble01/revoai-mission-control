import { Body, Controller, Get, Patch } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings/safety')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  getSafety() {
    return this.settings.getSafety();
  }

  @Patch()
  patchSafety(@Body() body: any) {
    return this.settings.updateSafety(body);
  }
}
