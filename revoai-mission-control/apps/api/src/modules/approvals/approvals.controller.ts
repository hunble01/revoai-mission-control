import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { ApprovalAction } from '@prisma/client';
import { ApprovalsService } from './approvals.service';
import { ApprovalActionDto } from './dto/approval.dto';
import { assertAdminToken, assertAdminRole, getActorRole } from '../../common/auth.util';

@Controller('drafts/:id')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  private guard(req: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'draft approvals');
  }

  @Post('approve')
  approve(@Req() req: any, @Param('id') id: string, @Body() body: ApprovalActionDto) {
    this.guard(req);
    return this.approvals.act(id, ApprovalAction.APPROVE, body?.notes);
  }

  @Post('reject')
  reject(@Req() req: any, @Param('id') id: string, @Body() body: ApprovalActionDto) {
    this.guard(req);
    return this.approvals.act(id, ApprovalAction.REJECT, body?.notes);
  }

  @Post('request-changes')
  requestChanges(@Req() req: any, @Param('id') id: string, @Body() body: ApprovalActionDto) {
    this.guard(req);
    return this.approvals.act(id, ApprovalAction.REQUEST_CHANGES, body?.notes);
  }

  @Post('edit-inline-approve')
  editInlineApprove(@Req() req: any, @Param('id') id: string, @Body() body: ApprovalActionDto) {
    this.guard(req);
    return this.approvals.act(id, ApprovalAction.EDIT_INLINE_APPROVE, body?.notes, body?.content);
  }

  @Post('approve-with-notes')
  approveWithNotes(@Req() req: any, @Param('id') id: string, @Body() body: ApprovalActionDto) {
    this.guard(req);
    return this.approvals.act(id, ApprovalAction.APPROVE_WITH_NOTES, body?.notes);
  }
}
