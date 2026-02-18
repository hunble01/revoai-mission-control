import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { DraftsService } from './drafts.service';

@Controller('drafts')
export class DraftsController {
  constructor(private readonly drafts: DraftsService) {}

  @Get()
  list() {
    return this.drafts.list();
  }

  @Post()
  create(@Body() body: any) {
    return this.drafts.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.drafts.update(id, body);
  }
}
