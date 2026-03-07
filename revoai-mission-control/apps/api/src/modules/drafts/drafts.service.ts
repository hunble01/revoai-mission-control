import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalAction, DraftStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { SettingsService } from '../settings/settings.service';

const allowedDraftTransitions: Record<DraftStatus, DraftStatus[]> = {
  DRAFT: [DraftStatus.NEEDS_APPROVAL],
  NEEDS_APPROVAL: [DraftStatus.DRAFT, DraftStatus.APPROVED, DraftStatus.REJECTED],
  APPROVED: [DraftStatus.DRAFT],
  REJECTED: [DraftStatus.DRAFT],
};

@Injectable()
export class DraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly settings: SettingsService,
  ) {}

  async list(q?: { search?: string; status?: string }) {
    return this.prisma.draft.findMany({
      where: {
        status: q?.status as any || undefined,
        OR: q?.search
          ? [
              { draftType: { contains: q.search, mode: 'insensitive' } },
              { channel: { equals: q.search as any } },
            ]
          : undefined,
      },
      include: { versions: true, approvals: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async create(data: any) {
    const draft = await this.prisma.draft.create({
      data: {
        campaignId: data.campaignId,
        leadId: data.leadId,
        channel: data.channel,
        draftType: data.draftType,
        createdBy: data.createdBy,
      },
    });
    await this.prisma.draftVersion.create({
      data: {
        draftId: draft.id,
        versionNumber: 1,
        content: data.content ?? '',
        changeNote: 'Initial draft',
      },
    });
    await this.events.publish({ eventType: 'draft.created', campaignId: draft.campaignId, payload: { draftId: draft.id } });
    return draft;
  }

  async update(id: string, data: any, actorRole: string) {
    const current = await this.prisma.draft.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Draft not found');

    if (data.status && data.status !== current.status) {
      const allowed = allowedDraftTransitions[current.status] || [];
      if (!allowed.includes(data.status)) {
        throw new BadRequestException(`Invalid draft transition ${current.status} -> ${data.status}`);
      }

      if (data.status === DraftStatus.APPROVED && actorRole !== 'admin') {
        throw new BadRequestException('Only admin can approve drafts');
      }
      if (data.status === DraftStatus.REJECTED && actorRole !== 'admin') {
        throw new BadRequestException('Only admin can reject drafts');
      }
    }

    if (data.content) {
      await this.prisma.draftVersion.create({
        data: {
          draftId: id,
          versionNumber: current.currentVersion + 1,
          content: data.content,
          changeNote: data.changeNote ?? 'Updated draft',
        },
      });
      data.currentVersion = current.currentVersion + 1;
    }

    const updated = await this.prisma.draft.update({ where: { id }, data });
    await this.events.publish({ eventType: 'draft.updated', campaignId: updated.campaignId, payload: { draftId: id } });
    return updated;
  }

  async approvalDecision(
    id: string,
    action: 'approve' | 'reject' | 'request-changes' | 'approve-with-notes' | 'edit-inline-approve',
    body: { notes?: string; content?: string },
    actorRole: string,
    actorId?: string,
  ) {
    if (actorRole !== 'admin') throw new BadRequestException('Only admin can perform approval decisions');

    const draft = await this.prisma.draft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.status !== DraftStatus.NEEDS_APPROVAL) {
      throw new BadRequestException('Draft is not in NEEDS_APPROVAL state');
    }

    const notes = (body?.notes || '').trim();
    const content = body?.content || '';

    let nextStatus: DraftStatus = DraftStatus.NEEDS_APPROVAL;
    let approvalAction: ApprovalAction = ApprovalAction.REQUEST_CHANGES;

    if (action === 'approve') {
      nextStatus = DraftStatus.APPROVED;
      approvalAction = ApprovalAction.APPROVE;
    } else if (action === 'reject') {
      nextStatus = DraftStatus.REJECTED;
      approvalAction = ApprovalAction.REJECT;
    } else if (action === 'request-changes') {
      nextStatus = DraftStatus.DRAFT;
      approvalAction = ApprovalAction.REQUEST_CHANGES;
    } else if (action === 'approve-with-notes') {
      nextStatus = DraftStatus.APPROVED;
      approvalAction = ApprovalAction.APPROVE_WITH_NOTES;
    } else if (action === 'edit-inline-approve') {
      if (!content.trim()) throw new BadRequestException('Inline content is required for inline approve');
      nextStatus = DraftStatus.APPROVED;
      approvalAction = ApprovalAction.EDIT_INLINE_APPROVE;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.draft.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Draft not found');

      if (action === 'edit-inline-approve') {
        await tx.draftVersion.create({
          data: {
            draftId: id,
            versionNumber: current.currentVersion + 1,
            content,
            changeNote: 'Inline edit during approval',
          },
        });
      }

      await tx.approval.create({
        data: {
          draftId: id,
          action: approvalAction,
          notes: notes || null,
          editorContent: action === 'edit-inline-approve' ? content : null,
          decidedBy: 'admin',
        },
      });

      const updatedDraft = await tx.draft.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(action === 'edit-inline-approve' ? { currentVersion: current.currentVersion + 1 } : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: 'user',
          actorId: actorId || null,
          action: 'draft.approval.decision',
          resourceType: 'draft',
          resourceId: id,
          beforeState: { status: current.status },
          afterState: { status: updatedDraft.status, currentVersion: updatedDraft.currentVersion },
          metadata: { decision: action },
        },
      });

      return updatedDraft;
    });

    await this.events.publish({
      eventType: 'draft.approval.decided',
      campaignId: updated.campaignId,
      payload: { draftId: id, action, nextStatus },
    });

    return {
      ok: true,
      draftId: id,
      action,
      nextStatus,
      currentVersion: updated.currentVersion,
    };
  }

  async markSentManual(id: string, actorRole: string) {
    if (actorRole !== 'admin') throw new BadRequestException('Admin only action');

    const safety = await this.settings.getSafety();
    const dry = (safety?.dry_run_mode as any)?.enabled;
    const channels = (safety?.outbound_channels as any) || {};

    const draft = await this.prisma.draft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.channel !== 'LINKEDIN') throw new BadRequestException('Manual mark sent is only enabled for LinkedIn drafts');
    if (draft.status !== DraftStatus.APPROVED) throw new BadRequestException('Draft must be approved before manual sent mark');

    // No auto-send ever in MVP; this is only manual status marking.
    if (dry === false && channels.linkedin !== true) {
      throw new BadRequestException('LinkedIn channel toggle is OFF');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedDraft = await tx.draft.update({ where: { id }, data: { status: DraftStatus.APPROVED } });
      let updatedLead: any = null;
      if (draft.leadId) {
        updatedLead = await tx.lead.update({ where: { id: draft.leadId }, data: { status: 'CONTACTED', lastActionAt: new Date() } });
      }
      await tx.auditLog.create({
        data: {
          actorType: 'user',
          action: 'draft.marked_sent',
          resourceType: 'draft',
          resourceId: draft.id,
          beforeState: { status: draft.status },
          afterState: { status: updatedDraft.status, leadStatus: updatedLead?.status },
          metadata: { manual: true, channel: 'LINKEDIN', dryRun: dry },
        },
      });
      return { updatedDraft, updatedLead };
    });

    await this.events.publish({
      eventType: 'draft.marked_sent',
      campaignId: draft.campaignId,
      payload: { draftId: draft.id, leadId: draft.leadId, manual: true },
    });

    return result;
  }
}
