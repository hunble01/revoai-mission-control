import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSafetyDto } from './dto/settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  getSettings() {
    return this.settings.getSafety();
  }

  @Get('safety')
  getSafety() {
    return this.settings.getSafety();
  }

  @Patch()
  patchSettings(@Body() body: any) {
    return this.settings.updateSafety(body);
  }

  @Get('brand')
  getBrand() {
    return this.settings.getBrand();
  }

  @Post('brand')
  saveBrand(@Body() body: any) {
    return this.settings.saveBrand(body);
  }

  @Patch('safety')
  patchSafety(@Body() body: UpdateSafetyDto) {
    return this.settings.updateSafety(body);
  }

  @Post('safety/danger/clear-draft-queue')
  clearDraftQueue() {
    return this.settings.clearDraftQueue();
  }

  @Post('safety/danger/reset-agent-states')
  resetAgentStates() {
    return this.settings.resetAgentStates();
  }
}
