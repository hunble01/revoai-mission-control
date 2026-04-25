import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { SocialPostsService } from './social-posts.service';

@Controller('social-posts')
export class SocialPostsController {
  constructor(private readonly social: SocialPostsService) {}

  @Get()
  list(@Req() req: any, @Query('status') status?: string) {
    assertAdminToken(req);
    return this.social.list(status);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    return this.social.create(body);
  }

  @Post('bulk')
  bulkCreate(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    return this.social.bulkCreate(body);
  }

  @Post('validate-brand-voice')
  validateBrandVoice(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    const issues = this.social.validateBrandVoice(String(body?.body || ''));
    return { ok: true, issues };
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    return this.social.update(id, body);
  }

  @Post(':id/approve')
  approve(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.social.transition(id, 'approved');
  }

  @Post(':id/reject')
  reject(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    return this.social.transition(id, 'draft', body?.notes || 'Rejected');
  }

  @Post(':id/feedback')
  feedback(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    return this.social.captureFeedback(id, body?.notes || '');
  }

  @Post(':id/schedule')
  schedule(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    return this.social.transition(id, 'scheduled', undefined, body?.scheduledAt);
  }

  @Get('history')
  history(@Req() req: any, @Query('limit') limit?: string) {
    assertAdminToken(req);
    return this.social.history(Number(limit) || 100);
  }

  @Post(':id/mark-posted')
  markPosted(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    return this.social.transition(id, 'posted', undefined, undefined, body?.externalPostId);
  }
}
