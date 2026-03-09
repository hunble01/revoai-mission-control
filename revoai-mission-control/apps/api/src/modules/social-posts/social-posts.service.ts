import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class SocialPostsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  list(status?: string) {
    return this.prisma.socialPost.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  create(body: any) {
    const platform = String(body?.platform || body?.channel || 'LINKEDIN').toUpperCase();
    const content = String(body?.content || body?.body || '').trim();
    const hashtags = Array.isArray(body?.hashtags) ? body.hashtags : [];
    return this.prisma.socialPost.create({
      data: {
        channel: (platform === 'BOTH' ? 'LINKEDIN' : platform) as any,
        body: content,
        mediaUrl: body?.mediaUrl || null,
        scheduledAt: body?.scheduledAt ? new Date(body.scheduledAt) : null,
        status: body?.status || 'draft',
        sourceType: body?.sourceType || 'manual',
        engagementStats: { hashtags, requestedPlatform: platform } as any,
      },
    });
  }

  async update(id: string, body: any) {
    const existing = await this.prisma.socialPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Social post not found');
    return this.prisma.socialPost.update({
      where: { id },
      data: {
        body: body?.body ?? existing.body,
        mediaUrl: body?.mediaUrl ?? existing.mediaUrl,
        status: body?.status ?? existing.status,
        scheduledAt: body?.scheduledAt ? new Date(body.scheduledAt) : existing.scheduledAt,
      },
    });
  }

  async transition(id: string, status: 'approved' | 'scheduled' | 'posted' | 'draft', notes?: string, scheduledAt?: string, externalPostId?: string) {
    const existing = await this.prisma.socialPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Social post not found');

    const updated = await this.prisma.socialPost.update({
      where: { id },
      data: {
        status,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : existing.scheduledAt,
        postedAt: status === 'posted' ? new Date() : existing.postedAt,
        externalPostId: externalPostId || existing.externalPostId,
      },
    });

    await this.events.publish({
      eventType: status === 'posted' ? 'POST_PUBLISHED' : 'POST_DRAFT_CREATED',
      payload: { socialPostId: updated.id, status, notes: notes || null },
    });

    return updated;
  }

  async captureFeedback(id: string, notes: string) {
    const existing = await this.prisma.socialPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Social post not found');

    const stats = (existing.engagementStats as any) || {};
    const feedback = Array.isArray(stats.feedback) ? stats.feedback : [];
    feedback.push({ at: new Date().toISOString(), notes });

    const updated = await this.prisma.socialPost.update({
      where: { id },
      data: { engagementStats: { ...stats, feedback } as any },
    });

    await this.events.publish({ eventType: 'POST_DRAFT_CREATED', payload: { socialPostId: id, feedback: true } });
    return { ok: true, id: updated.id };
  }
}
