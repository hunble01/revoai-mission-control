import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { assertAdminToken } from '../../common/auth.util';
import { SocialReplyService } from './social-reply.service';

@Controller('social-reply')
export class SocialReplyController {
  constructor(private readonly svc: SocialReplyService) {}

  // POST /api/social-reply/social_post/:id/assist  (comment-on-post intelligence)
  // POST /api/social-reply/linkedin_message/:id/assist  (LinkedIn DM thread)
  // POST /api/social-reply/meta_message/:id/assist  (FB / IG DM thread)
  @Post(':subjectType/:id/assist')
  assist(@Req() req: any, @Param('subjectType') subjectType: string, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    return this.svc.assistSocialReply(subjectType as any, id, String(body?.replyText || ''));
  }

  @Get(':subjectType/:id/analyses')
  listAnalyses(@Req() req: any, @Param('subjectType') subjectType: string, @Param('id') id: string, @Query('limit') limit?: string) {
    assertAdminToken(req);
    return this.svc.listAnalyses(subjectType as any, id, limit ? Number(limit) : 10);
  }
}
