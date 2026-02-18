import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApprovalAction } from '@prisma/client';
import { ApprovalsService } from './approvals.service';

@Controller('drafts/:id')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Post('approve')
  approve(@Param('id') id: string, @Body() body: any) {
    return this.approvals.act(id, ApprovalAction.APPROVE, body?.notes);
  }

  @Post('reject')
  reject(@Param('id') id: string, @Body() body: any) {
    return this.approvals.act(id, ApprovalAction.REJECT, body?.notes);
  }

  @Post('request-changes')
  requestChanges(@Param('id') id: string, @Body() body: any) {
    return this.approvals.act(id, ApprovalAction.REQUEST_CHANGES, body?.notes);
  }

  @Post('edit-inline-approve')
  editInlineApprove(@Param('id') id: string, @Body() body: any) {
    return this.approvals.act(id, ApprovalAction.EDIT_INLINE_APPROVE, body?.notes, body?.content);
  }

  @Post('approve-with-notes')
  approveWithNotes(@Param('id') id: string, @Body() body: any) {
    return this.approvals.act(id, ApprovalAction.APPROVE_WITH_NOTES, body?.notes);
  }
}
