import { Controller, Get, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { TodayService } from './today.service';

@Controller('today')
export class TodayController {
  constructor(private readonly today: TodayService) {}

  @Get('summary')
  summary(@Req() req: any) {
    assertAdminToken(req);
    return this.today.summary();
  }
}
