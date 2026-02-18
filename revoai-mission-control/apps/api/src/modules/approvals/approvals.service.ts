import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalAction, DraftStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

const draftTransitionsByAction: Record<ApprovalAction, DraftStatus> = {
  APPROVE: DraftStatus.APPROVED,
  REJECT: DraftStatus.REJECTED,
  REQUEST_CHANGES: DraftStatus.DRAFT,
  EDIT_INLINE_APPROVE: DraftStatus.APPROVED,
  APPROVE_WITH_NOTES: DraftStatus.APPROVED,
};

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async act(draftId: string, action: ApprovalAction, notes?: string, editorContent?: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const draft = await tx.draft.findUnique({ where: { id: draftId } });
      if (!draft) throw new NotFoundException('Draft not found');
      if (draft.status !== DraftStatus.NEEDS_APPROVAL) {
        throw new BadRequestException(`Draft must be NEEDS_APPROVAL before approval action. Current: ${draft.status}`);
      }

      const status = draftTransitionsByAction[action];

      if (action === ApprovalAction.EDIT_INLINE_APPROVE && !editorContent) {
        throw new BadRequestException('Inline edit content is required');
      }

      let nextVersion = draft.currentVersion;
      if (action === ApprovalAction.EDIT_INLINE_APPROVE && editorContent) {
        nextVersion = draft.currentVersion + 1;
        await tx.draftVersion.create({
          data: {
            draftId,
            versionNumber: nextVersion,
            content: editorContent,
            changeNote: 'Admin inline edit before approval',
          },
        });
      }

      const savedDraft = await tx.draft.update({
        where: { id: draftId },
        data: { status, currentVersion: nextVersion },
      });

      const approval = await tx.approval.create({
        data: { draftId, action, notes, editorContent },
      });

      await tx.auditLog.create({
        data: {
          actorType: 'user',
          action: `approval.${action.toLowerCase()}`,
          resourceType: 'draft',
          resourceId: draftId,
          beforeState: { status: draft.status },
          afterState: { status },
          metadata: { notes: notes ?? null },
        },
      });

      return { savedDraft, approval };
    });

    const eventType = action === ApprovalAction.APPROVE_WITH_NOTES
      ? 'approval.approved_with_notes'
      : `approval.${action.toLowerCase()}`;

    await this.events.publish({
      eventType,
      campaignId: updated.savedDraft.campaignId,
      payload: { draftId, status: updated.savedDraft.status, notes: notes ?? null },
    });

    return updated;
  }
}
