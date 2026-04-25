import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// /today aggregator. One round-trip → everything that needs Michael's
// attention this morning. Avoids hitting 6 separate endpoints from the UI.

@Injectable()
export class TodayService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
    const dayAhead = new Date(now.getTime() + 24 * 3600 * 1000);
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);

    const [
      draftsPending,
      socialDraftsPending,
      socialScheduledNext24,
      pendingReplies,
      leadsNeedingDraft,
      followupsDueSoon,
      sentLast24,
      socialPostedLast24,
      campaignsScheduled,
      newLeadsLast24,
    ] = await Promise.all([
      // Email/LinkedIn drafts in approval queue
      this.prisma.draft.findMany({
        where: { status: 'NEEDS_APPROVAL' as any },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, channel: true, subject: true, content: true, createdAt: true, leadId: true },
      }),
      // Social posts in draft awaiting approval
      this.prisma.socialPost.findMany({
        where: { status: 'draft' },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, channel: true, body: true, createdAt: true, groupId: true, mediaUrl: true, sourceType: true, engagementStats: true },
      }),
      // Scheduled social posts firing in the next 24h
      this.prisma.socialPost.findMany({
        where: { status: 'scheduled', scheduledAt: { gte: now, lte: dayAhead } },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
        select: { id: true, channel: true, body: true, scheduledAt: true, groupId: true },
      }),
      // Replies analyzed but no apply-action taken yet
      (this.prisma as any).replyAnalysis.findMany({
        where: { appliedAction: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Leads in NEW state (haven't been drafted yet)
      this.prisma.lead.findMany({
        where: { status: { in: ['NEW', 'ENRICHED', 'RESEARCHED'] as any } as any },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, businessName: true, niche: true, region: true, status: true, fitScore: true },
      }),
      // Follow-up sequence stages 1-3 with last outbound > 3 days ago
      this.prisma.lead.count({
        where: {
          followUpStage: { in: [1, 2, 3] },
          lastOutboundAt: { lt: new Date(now.getTime() - 3 * 24 * 3600 * 1000) },
        } as any,
      }),
      // Email sends in last 24h
      this.prisma.outboundSend.count({
        where: {
          status: { in: ['sent', 'delivered', 'opened', 'clicked'] } as any,
          sentAt: { gte: dayAgo },
        } as any,
      }).catch(() => 0),
      // Social posts published in last 24h
      this.prisma.socialPost.count({
        where: { status: 'posted', postedAt: { gte: dayAgo } },
      }),
      // Campaigns with a scheduled autorun set
      this.prisma.campaign.findMany({
        where: { scheduledAutorunAt: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 3600 * 1000) } } as any,
        orderBy: { scheduledAutorunAt: 'asc' } as any,
        take: 5,
        select: { id: true, name: true, niche: true, scheduledAutorunAt: true } as any,
      }),
      // New leads added today
      this.prisma.lead.count({
        where: { createdAt: { gte: startOfToday } },
      }),
    ]);

    return {
      generatedAt: now,
      counts: {
        draftsPending: draftsPending.length,
        socialDraftsPending: socialDraftsPending.length,
        socialScheduledNext24: socialScheduledNext24.length,
        pendingReplies: pendingReplies.length,
        leadsNeedingDraft: leadsNeedingDraft.length,
        followupsDueSoon,
        sentLast24,
        socialPostedLast24,
        campaignsScheduled: campaignsScheduled.length,
        newLeadsLast24: newLeadsLast24,
      },
      lists: {
        drafts: draftsPending,
        socialDrafts: socialDraftsPending,
        socialScheduled: socialScheduledNext24,
        replies: pendingReplies,
        leadsToWork: leadsNeedingDraft,
        scheduledCampaigns: campaignsScheduled,
      },
    };
  }
}
