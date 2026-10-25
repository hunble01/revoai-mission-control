import { Controller, Post, Req } from '@nestjs/common';
import { SeedService } from './seed.service';
import { assertAdminToken, assertAdminRole, getActorRole } from '../../common/auth.util';

@Controller('seed')
export class SeedController {
  constructor(private readonly seed: SeedService) {}

  @Post('load')
  load(@Req() req: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'seed loading');
    return this.seed.load();
  }
}
