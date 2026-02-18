import { Injectable } from '@nestjs/common';
import { ApprovalAction, DraftStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async act(draftId: string, action: ApprovalAction, notes?: string, editorContent?: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const draft = await tx.draft.findUnique({ where: { id: draftId } });
      if (!draft) throw new Error('Draft not found');

      let status: DraftStatus = draft.status;
      if ([ApprovalAction.APPROVE, ApprovalAction.EDIT_INLINE_APPROVE, ApprovalAction.APPROVE_WITH_NOTES].includes(action)) {
        status = DraftStatus.APPROVED;
      }
      if (action === ApprovalAction.REJECT) status = DraftStatus.REJECTED;
      if (action === ApprovalAction.REQUEST_CHANGES) status = DraftStatus.NEEDS_APPROVAL;

      if (action === ApprovalAction.EDIT_INLINE_APPROVE && editorContent) {
        await tx.draftVersion.create({
          data: {
            draftId,
            versionNumber: draft.currentVersion + 1,
            content: editorContent,
            changeNote: 'Admin inline edit before approval',
          },
        });
      }

      const savedDraft = await tx.draft.update({
        where: { id: draftId },
        data: {
          status,
          currentVersion: action === ApprovalAction.EDIT_INLINE_APPROVE && editorContent ? draft.currentVersion + 1 : draft.currentVersion,
        },
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
      payload: { draftId, status: updated.savedDraft.status, notes: notes ?? null },
    });

    return updated;
  }
}
