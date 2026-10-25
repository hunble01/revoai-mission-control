import { Controller, Get, Req } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { assertAdminToken } from '../../common/auth.util';

@Controller('approvals')
export class ApprovalsListController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    assertAdminToken(req);
    const [drafts, posts] = await Promise.all([
      this.prisma.draft.findMany({ where: { status: 'NEEDS_APPROVAL' }, orderBy: { createdAt: 'desc' }, take: 200 }),
      this.prisma.socialPost.findMany({ where: { status: 'needs_approval' }, orderBy: { createdAt: 'desc' }, take: 200 }),
    ]);

    const mappedPosts = posts.map((p) => ({
      id: p.id,
      channel: p.channel,
      draftType: 'social_post',
      status: String(p.status || '').toUpperCase(),
      currentVersion: 1,
      taskId: null,
      isSocialPost: true,
      content: p.body,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return [...drafts, ...mappedPosts];
  }
}
