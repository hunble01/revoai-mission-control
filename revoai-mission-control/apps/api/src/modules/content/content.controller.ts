import { Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { ContentService } from './content.service';

@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Post('generate-ideas')
  generate(@Req() req: any) {
    assertAdminToken(req);
    return this.content.generateIdeas();
  }

  @Get('ideas')
  ideas(@Req() req: any) {
    assertAdminToken(req);
    return this.content.listIdeas();
  }

  @Delete('ideas/:id')
  dismiss(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.content.dismissIdea(id);
  }
}
