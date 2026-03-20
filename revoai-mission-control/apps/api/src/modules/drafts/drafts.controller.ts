import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { DraftsService } from './drafts.service';
import { CreateDraftDto, UpdateDraftDto } from './dto/draft.dto';
import { assertAdminToken, assertAdminRole, getActorRole } from '../../common/auth.util';

@Controller('drafts')
export class DraftsController {
  constructor(private readonly drafts: DraftsService) {}

  @Get()
  list(@Req() req: any, @Query('search') search?: string, @Query('status') status?: string) {
    assertAdminToken(req);
    return this.drafts.list({ search, status });
  }

  @Post()
  create(@Req() req: any, @Body() body: CreateDraftDto) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'draft create');
    return this.drafts.create(body);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: UpdateDraftDto) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'draft update');
    return this.drafts.update(id, body, getActorRole(req));
  }

  @Post(':id/approve')
  approve(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    const actorId = req?.headers?.['x-actor-id'] ? String(req.headers['x-actor-id']) : undefined;
    return this.drafts.approvalDecision(id, 'approve', body, getActorRole(req), actorId);
  }

  @Post(':id/reject')
  reject(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    const actorId = req?.headers?.['x-actor-id'] ? String(req.headers['x-actor-id']) : undefined;
    return this.drafts.approvalDecision(id, 'reject', body, getActorRole(req), actorId);
  }

  @Post(':id/request-changes')
  requestChanges(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    const actorId = req?.headers?.['x-actor-id'] ? String(req.headers['x-actor-id']) : undefined;
    return this.drafts.approvalDecision(id, 'request-changes', body, getActorRole(req), actorId);
  }

  @Post(':id/approve-with-notes')
  approveWithNotes(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    const actorId = req?.headers?.['x-actor-id'] ? String(req.headers['x-actor-id']) : undefined;
    return this.drafts.approvalDecision(id, 'approve-with-notes', body, getActorRole(req), actorId);
  }

  @Post(':id/edit-inline-approve')
  editInlineApprove(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    const actorId = req?.headers?.['x-actor-id'] ? String(req.headers['x-actor-id']) : undefined;
    return this.drafts.approvalDecision(id, 'edit-inline-approve', body, getActorRole(req), actorId);
  }

  @Post(':id/send-email')
  sendEmail(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.drafts.sendApprovedEmail(id, getActorRole(req), req?.auth?.uid);
  }

  @Get('email-send-history')
  emailSendHistory(@Req() req: any, @Query('limit') limit?: string) {
    assertAdminToken(req);
    return this.drafts.listEmailSendHistory(Number(limit) || 50);
  }

  @Get('send-history')
  sendHistory(@Req() req: any, @Query('limit') limit?: string) {
    assertAdminToken(req);
    return this.drafts.listSendHistory(Number(limit) || 100);
  }

  @Post('email/delivery-hook')
  emailDeliveryHook(@Req() req: any, @Body() body: any) {
    const expected = String(process.env.EMAIL_WEBHOOK_SECRET || '').trim();
    if (expected) {
      const provided = String(req?.headers?.['x-email-webhook-secret'] || body?.secret || '').trim();
      if (!provided || provided !== expected) {
        throw new BadRequestException('Invalid webhook secret');
      }
    }
    return this.drafts.handleEmailDeliveryHook(body);
  }

  @Post(':id/send-linkedin')
  sendLinkedin(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.drafts.sendApprovedLinkedin(id, getActorRole(req));
  }

  @Post(':id/send-facebook')
  sendFacebook(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.drafts.sendApprovedFacebook(id, getActorRole(req));
  }

  @Post(':id/queue-send')
  queueSend(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.drafts.queueApprovedSend(id, getActorRole(req), req?.auth?.uid);
  }

  @Post('queue/process')
  processQueue(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    const channel = body?.channel ? String(body.channel).toUpperCase() : undefined;
    return this.drafts.processQueuedOutbound(Number(body?.limit) || 10, channel as any);
  }

  @Post('queue/:id/retry')
  retryQueueJob(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.drafts.retryFailedQueueJob(id);
  }

  @Post(':id/mark-sent-manual')
  markSent(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.drafts.markSentManual(id, getActorRole(req));
  }
}
