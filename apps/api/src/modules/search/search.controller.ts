import { Controller, Get, Query, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  find(@Req() req: any, @Query('q') q?: string) {
    assertAdminToken(req);
    return this.search.find(q || '');
  }

  @Get('notifications')
  notifications(@Req() req: any) {
    assertAdminToken(req);
    return this.search.notifications();
  }
}
