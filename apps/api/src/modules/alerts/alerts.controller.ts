import { Controller, Get, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@Req() req: any) {
    assertAdminToken(req);
    return this.alerts.list();
  }
}
