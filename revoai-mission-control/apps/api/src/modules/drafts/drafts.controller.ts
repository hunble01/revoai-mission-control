import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { DraftsService } from './drafts.service';
import { CreateDraftDto, UpdateDraftDto } from './dto/draft.dto';
import { assertAdminToken, getActorRole } from '../../common/auth.util';

@Controller('drafts')
export class DraftsController {
  constructor(private readonly drafts: DraftsService) {}

  @Get()
  list(@Req() req: any, @Query('search') search?: string, @Query('status') status?: string) {
    assertAdminToken(req);
    return this.drafts.list({ search, status });
  }

  @Post()
  create(@Req() req: any, @Body() body: CreateDraftDto) {
    assertAdminToken(req);
    return this.drafts.create(body);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: UpdateDraftDto) {
    assertAdminToken(req);
    return this.drafts.update(id, body, getActorRole(req));
  }

  @Post(':id/mark-sent-manual')
  markSent(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.drafts.markSentManual(id, getActorRole(req));
  }
}
