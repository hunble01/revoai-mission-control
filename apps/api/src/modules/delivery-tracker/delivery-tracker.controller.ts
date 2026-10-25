import { Controller, Post, Req } from '@nestjs/common';
import { DeliveryTrackerService } from './delivery-tracker.service';
import { assertAdminToken, assertAdminRole, getActorRole } from '../../common/auth.util';

@Controller('delivery-tracker')
export class DeliveryTrackerController {
  constructor(private readonly svc: DeliveryTrackerService) {}

  @Post('run')
  async run(@Req() req: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'delivery-tracker run');
    return this.svc.runCycle();
  }
}
