import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createDecipheriv, createHash } from 'crypto';
import { ApprovalAction, DraftStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { SettingsService } from '../settings/settings.service';

const allowedDraftTransitions: Record<string, string[]> = {
  DRAFT: [DraftStatus.NEEDS_APPROVAL],
  NEEDS_APPROVAL: [DraftStatus.DRAFT, DraftStatus.APPROVED, DraftStatus.REJECTED],
  APPROVED: [DraftStatus.DRAFT, 'SENT'],
  REJECTED: [DraftStatus.DRAFT],
  SENT: [],
};

@Injectable()
export class DraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly settings: SettingsService,
  ) {}

  private decryptSecret(value?: string | null) {
    if (!value) return null;
    const [ivB64, tagB64, dataB64] = String(value).split('.');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const secret = createHash('sha256').update(process.env.SESSION_SECRET || process.env.ADMIN_TOKEN || 'change-me').digest();
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const data = Buffer.from(dataB64, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', secret, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(data), decipher.final()]);
    return out.toString('utf8');
  }

  async list(q?: { search?: string; status?: string }) {
    const status = q?.status ? String(q.status).toUpperCase() : undefined;
    return this.prisma.draft.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        OR: q?.search
          ? [
              { draftType: { contains: q.search, mode: 'insensitive' } },
              { channel: { equals: q.search as any } },
            ]
          : undefined,
      },
      include: { versions: true, approvals: true, lead: true },
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
        status: (data?.status ? String(data.status).toUpperCase() : DraftStatus.NEEDS_APPROVAL) as any,
        content: data.content ?? '',
        subject: data.subject ?? null,
        createdBy: data.createdBy,
      } as any,
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
      contractVersion: 'mvp.v1',
      data: {
        draftId: id,
        action,
        nextStatus,
        currentVersion: updated.currentVersion,
      },
    };
  }

  async sendApprovedEmail(id: string, actorRole: string, actorId?: string) {
    if (actorRole !== 'admin') throw new BadRequestException('Admin only action');

    await this.settings.assertOutboundAllowed('email');

    const draft = await this.prisma.draft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.channel !== 'EMAIL') throw new BadRequestException('Send email is only enabled for EMAIL drafts');
    if (draft.status !== DraftStatus.APPROVED) throw new BadRequestException('Draft must be approved before send');

    const existingSent = await this.prisma.outboundSend.findFirst({
      where: { provider: 'EMAIL', draftId: draft.id, status: 'sent' },
      orderBy: { sentAt: 'desc' },
    });
    if (existingSent) {
      throw new BadRequestException('Email already sent for this draft');
    }

    const lead = draft.leadId ? await this.prisma.lead.findUnique({ where: { id: draft.leadId } }) : null;
    const to = (lead?.email || '').trim();
    if (!to) throw new BadRequestException('Lead email is required for email send');

    const version = await this.prisma.draftVersion.findFirst({
      where: { draftId: draft.id, versionNumber: draft.currentVersion },
    });
    const body = (version?.content || (draft as any).content || '').trim();
    if (!body) throw new BadRequestException('Draft content is empty');

    const connection = await this.prisma.connection.findUnique({ where: { provider: 'EMAIL' } });
    const encryptedAccessToken = (connection?.tokenMeta as any)?.encryptedAccessToken || null;
    const accessToken = this.decryptSecret(encryptedAccessToken);

    const providerSendUrl = process.env.EMAIL_PROVIDER_SEND_URL || '';
    const from = process.env.EMAIL_FROM || process.env.BOOTSTRAP_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
    const stubMode = String(process.env.OAUTH_STUB_MODE || '1') !== '0';

    const classifyFailure = (statusCode?: number, msg?: string) => {
      const m = String(msg || '').toLowerCase();
      if (statusCode === 401 || statusCode === 403 || m.includes('unauthorized') || m.includes('forbidden') || m.includes('token')) return 'auth_error';
      if (statusCode === 429 || statusCode === 502 || statusCode === 503 || statusCode === 504 || m.includes('timeout') || m.includes('temporar')) return 'transient_failure';
      if (statusCode && statusCode >= 500) return 'provider_error';
      return 'permanent_failure';
    };

    let messageId: string | null = null;
    let sendStatus: 'sent' | 'transient_failure' | 'permanent_failure' | 'auth_error' | 'provider_error' = 'provider_error';
    let sendError: string | null = null;
    let attempts = 0;
    const maxAttempts = 2;

    const smtpHost = String(process.env.EMAIL_SMTP_HOST || '').trim();
    const smtpPort = Number(process.env.EMAIL_SMTP_PORT || 587);
    const smtpUser = String(process.env.EMAIL_SMTP_USER || '').trim();
    const smtpPass = String(process.env.EMAIL_SMTP_PASS || '').trim();
    const smtpSecure = String(process.env.EMAIL_SMTP_SECURE || 'false').toLowerCase() === 'true';
    const useSmtp = !!(smtpHost && smtpUser && smtpPass && from);

    while (attempts < maxAttempts) {
      attempts += 1;
      try {
        if (stubMode && !useSmtp && (!providerSendUrl || !accessToken)) {
          messageId = `stub_email_${Date.now()}`;
          sendStatus = 'sent';
          sendError = null;
          break;
        }

        if (useSmtp) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const nodemailer = require('nodemailer');
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: { user: smtpUser, pass: smtpPass },
          });

          const info = await transporter.sendMail({
            from,
            to,
            subject: `RevoAI Outreach - ${lead?.businessName || 'Lead'}`,
            text: body,
          });

          messageId = (info as any)?.messageId || null;
          sendStatus = 'sent';
          sendError = null;
          break;
        }

        if (!providerSendUrl || !from || !accessToken) {
          throw new Error('Email provider send config/token missing');
        }

        const sendRes = await fetch(providerSendUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            from,
            to,
            subject: `RevoAI Outreach - ${lead?.businessName || 'Lead'}`,
            text: body,
          }),
        });

        const sendJson: any = await sendRes.json().catch(() => ({}));
        if (!sendRes.ok) {
          sendStatus = classifyFailure(sendRes.status, sendJson?.error?.message || sendJson?.message) as any;
          sendError = sendJson?.error?.message || sendJson?.message || `Email provider send failed (HTTP ${sendRes.status})`;
          if (sendStatus === 'transient_failure' && attempts < maxAttempts) continue;
          break;
        }

        messageId = sendJson?.id || sendJson?.messageId || null;
        sendStatus = 'sent';
        sendError = null;
        break;
      } catch (e: any) {
        const code = String(e?.code || '').toUpperCase();
        sendError = e?.message || 'Email send failed';
        if (code === 'EAUTH') sendStatus = 'auth_error';
        else if (code === 'ETIMEDOUT' || code === 'ECONNECTION' || code === 'ESOCKET') sendStatus = 'transient_failure';
        else sendStatus = classifyFailure(undefined, sendError) as any;
        if (sendStatus === 'transient_failure' && attempts < maxAttempts) continue;
        break;
      }
    }

    await this.prisma.outboundSend.create({
      data: {
        provider: 'EMAIL',
        draftId: draft.id,
        leadId: draft.leadId,
        status: sendStatus,
        externalMessageId: messageId,
        error: sendError ? `${sendError} (attempts:${attempts})` : null,
        sentAt: new Date(),
      },
    });

    if (sendStatus === 'sent') {
      await this.prisma.draft.update({ where: { id }, data: { status: 'SENT' as any } });
      if (draft.leadId) {
        await this.prisma.lead.update({ where: { id: draft.leadId }, data: { status: 'CONTACTED', lastActionAt: new Date() } }).catch(() => {});
      }
    }

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: actorId || null,
        action: 'draft.email_send',
        resourceType: 'draft',
        resourceId: draft.id,
        metadata: {
          provider: 'EMAIL',
          result: sendStatus,
          attempts,
          hasExternalId: !!messageId,
        } as any,
      },
    });

    await this.events.publish({
      eventType: sendStatus === 'sent' ? 'draft.email.sent' : 'draft.email.failed',
      campaignId: draft.campaignId,
      payload: {
        draftId: draft.id,
        leadId: draft.leadId,
        provider: 'EMAIL',
        result: sendStatus,
        attempts,
      },
    });

    if (sendStatus !== 'sent') {
      throw new BadRequestException(sendError || `Email send failed (${sendStatus})`);
    }

    return { ok: true, provider: 'EMAIL', status: sendStatus, attempts, externalMessageId: messageId };
  }

  async emailPipelineStatus() {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const rows = await this.prisma.outboundSend.findMany({
      where: { provider: 'EMAIL', sentAt: { gte: start } },
      orderBy: { sentAt: 'desc' },
      take: 500,
    });

    const sent = rows.filter((r: any) => String(r.status).toLowerCase() === 'sent').length;
    const failed = rows.length - sent;
    const failureRate = rows.length ? Math.round((failed / rows.length) * 100) : 0;

    return {
      windowHours: 24,
      totals: { attempts: rows.length, sent, failed, failureRatePct: failureRate },
      lastAttemptAt: rows[0]?.sentAt || null,
      stable: failureRate < 20,
      recentFailures: rows
        .filter((r: any) => String(r.status).toLowerCase() !== 'sent')
        .slice(0, 5)
        .map((r: any) => ({ id: r.id, status: r.status, error: r.error, sentAt: r.sentAt })),
    };
  }

  async listEmailSendHistory(limit = 50) {
    const rows = await this.prisma.outboundSend.findMany({
      where: { provider: 'EMAIL' },
      orderBy: { sentAt: 'desc' },
      take: Math.min(Math.max(Number(limit) || 50, 1), 200),
    });

    const leadIds = Array.from(new Set(rows.map((r) => r.leadId).filter(Boolean))) as string[];
    const leads = leadIds.length
      ? await this.prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, email: true } })
      : [];
    const emailByLeadId = new Map(leads.map((l) => [l.id, l.email || null]));

    return rows.map((r: any) => ({
      id: r.id,
      draftId: r.draftId || null,
      recipient: r.leadId ? (emailByLeadId.get(r.leadId) || null) : null,
      provider: r.provider,
      status: r.status,
      timestamp: r.sentAt,
      externalMessageId: r.externalMessageId || null,
      failureClassification: r.status === 'sent' ? null : r.status,
      error: r.error || null,
    }));
  }

  async handleEmailDeliveryHook(payload: any) {
    const externalMessageId = String(payload?.externalMessageId || payload?.messageId || '').trim();
    const outboundSendId = String(payload?.outboundSendId || '').trim();
    const type = String(payload?.type || payload?.event || '').trim().toLowerCase();
    const error = String(payload?.error || payload?.reason || '').trim() || null;

    if (!externalMessageId && !outboundSendId) {
      throw new BadRequestException('externalMessageId or outboundSendId is required');
    }

    let nextStatus = 'provider_error';
    if (type.includes('bounce') || type.includes('hard_fail') || type.includes('reject')) nextStatus = 'permanent_failure';
    else if (type.includes('temp') || type.includes('retry') || type.includes('defer')) nextStatus = 'transient_failure';
    else if (type.includes('auth')) nextStatus = 'auth_error';

    const where = outboundSendId ? { id: outboundSendId } : { externalMessageId };
    const current = await this.prisma.outboundSend.findFirst({ where: where as any });
    if (!current) throw new NotFoundException('Outbound send record not found');

    const updated = await this.prisma.outboundSend.update({
      where: { id: current.id },
      data: { status: nextStatus, error: error || current.error || `delivery_event:${type || 'unknown'}` },
    });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'system',
        action: 'draft.email_delivery_update',
        resourceType: 'outbound_send',
        resourceId: updated.id,
        metadata: {
          provider: 'EMAIL',
          eventType: type || 'unknown',
          status: nextStatus,
        } as any,
      },
    });

    await this.events.publish({
      eventType: 'draft.email.delivery_update',
      campaignId: null,
      payload: {
        outboundSendId: updated.id,
        externalMessageId: updated.externalMessageId,
        status: updated.status,
      },
    });

    return { ok: true, id: updated.id, status: updated.status };
  }

  async sendApprovedLinkedin(id: string, actorRole: string) {
    if (actorRole !== 'admin') throw new BadRequestException('Admin only action');
    await this.settings.assertOutboundAllowed('linkedin');

    const draft = await this.prisma.draft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.channel !== 'LINKEDIN') throw new BadRequestException('LinkedIn send only for LinkedIn drafts');
    if (draft.status !== DraftStatus.APPROVED) throw new BadRequestException('Draft must be approved before send');

    const version = await this.prisma.draftVersion.findFirst({ where: { draftId: draft.id, versionNumber: draft.currentVersion } });
    const messageBody = (version?.content || (draft as any).content || '').trim();
    if (!messageBody) throw new BadRequestException('Draft content is empty');

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const usedToday = await this.prisma.linkedinMessage.count({ where: { status: 'sent', sentAt: { gte: start, lt: end } } as any });
    if (usedToday >= 20) throw new BadRequestException('LinkedIn DM daily limit reached (20/day)');

    const msg = await this.prisma.linkedinMessage.create({
      data: { leadId: draft.leadId, draftId: draft.id, messageBody, status: 'approved' },
    });

    const sent = await this.prisma.linkedinMessage.update({
      where: { id: msg.id },
      data: { status: 'sent', sentAt: new Date(), externalThreadId: `li_dm_stub_${Date.now()}` },
    });

    await this.prisma.draft.update({ where: { id }, data: { status: 'SENT' as any } });
    if (draft.leadId) {
      await this.prisma.lead.update({ where: { id: draft.leadId }, data: { status: 'CONTACTED', lastActionAt: new Date() } }).catch(() => {});
    }

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        action: 'draft.linkedin_send',
        resourceType: 'draft',
        resourceId: draft.id,
        metadata: { messageId: sent.id } as any,
      },
    });

    await this.events.publish({ eventType: 'LINKEDIN_DM_SENT', campaignId: draft.campaignId, payload: { draftId: draft.id, linkedinMessageId: sent.id } });
    return { ok: true, id: sent.id };
  }

  async sendApprovedFacebook(id: string, actorRole: string) {
    if (actorRole !== 'admin') throw new BadRequestException('Admin only action');
    await this.settings.assertOutboundAllowed('facebook');

    const draft = await this.prisma.draft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.channel !== 'FACEBOOK') throw new BadRequestException('Facebook send only for Facebook drafts');
    if (draft.status !== DraftStatus.APPROVED) throw new BadRequestException('Draft must be approved before send');

    const res = await fetch(`${process.env.PUBLIC_API_BASE || 'http://localhost:3001'}/api/facebook/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-token': process.env.ADMIN_TOKEN || 'change-me' },
      body: JSON.stringify({ draftId: draft.id, mode: 'draft' }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new BadRequestException(j?.error?.message || `Facebook publish failed (${res.status})`);

    await this.prisma.draft.update({ where: { id }, data: { status: 'SENT' as any } });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        action: 'draft.facebook_send',
        resourceType: 'draft',
        resourceId: draft.id,
      },
    });

    return { ok: true, externalPostId: j?.externalPostId || null };
  }

  async queueApprovedSend(id: string, actorRole: string, actorId?: string) {
    if (actorRole !== 'admin') throw new BadRequestException('Admin only action');

    const draft = await this.prisma.draft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.status !== DraftStatus.APPROVED) throw new BadRequestException('Draft must be approved before queueing');

    const existingQueued = await this.prisma.outboundQueue.findFirst({
      where: {
        draftId: id,
        status: { in: ['DRAFT', 'APPROVED', 'QUEUED', 'SENDING'] as any },
      } as any,
      orderBy: { createdAt: 'desc' },
    });
    if (existingQueued) {
      throw new BadRequestException('Draft already has an active queue job');
    }

    const version = await this.prisma.draftVersion.findFirst({ where: { draftId: draft.id, versionNumber: draft.currentVersion } });
    const payload = {
      content: version?.content || (draft as any).content || '',
      subject: (draft as any).subject || null,
      draftType: draft.draftType,
      leadId: draft.leadId,
    };

    const queued = await this.prisma.outboundQueue.create({
      data: {
        channel: draft.channel as any,
        draftId: draft.id,
        leadId: draft.leadId,
        campaignId: draft.campaignId,
        status: 'QUEUED',
        approvedAt: new Date(),
        approvedBy: actorId || null,
        payload: payload as any,
        metadata: { queuedFrom: 'drafts.queueApprovedSend' } as any,
      } as any,
    });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: actorId || null,
        action: 'draft.queued_for_send',
        resourceType: 'draft',
        resourceId: draft.id,
        metadata: { queueId: queued.id, channel: draft.channel } as any,
      },
    });

    await this.events.publish({
      eventType: 'draft.queued_for_send',
      campaignId: draft.campaignId,
      payload: { draftId: draft.id, queueId: queued.id, channel: draft.channel },
    });

    return { ok: true, queueId: queued.id, status: queued.status };
  }

  async processQueuedOutbound(limit = 10, channel?: 'LINKEDIN' | 'FACEBOOK') {
    const max = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const rows = await this.prisma.outboundQueue.findMany({
      where: {
        status: 'QUEUED' as any,
        OR: [{ sendAfter: null }, { sendAfter: { lte: new Date() } }],
        ...(channel ? { channel: channel as any } : { channel: { in: ['LINKEDIN', 'FACEBOOK'] as any } }),
      } as any,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: max,
    });

    const classifyFailure = (msg: string) => {
      const m = String(msg || '').toLowerCase();
      if (m.includes('expired') || m.includes('missing') || m.includes('not connected') || m.includes('auth')) return 'AUTH_OR_TOKEN';
      if (m.includes('daily cap') || m.includes('limit') || m.includes('kill-switch')) return 'POLICY_LIMIT';
      if (m.includes('timeout') || m.includes('temporary') || m.includes('transient')) return 'TRANSIENT';
      if (m.includes('unsupported') || m.includes('missing draft')) return 'CONFIG';
      return 'PROVIDER_OR_UNKNOWN';
    };

    const results: any[] = [];
    for (const q of rows as any[]) {
      await this.prisma.outboundQueue.update({ where: { id: q.id }, data: { status: 'SENDING', workerLockedAt: new Date() } as any });
      try {
        if (!q.draftId) throw new Error('Missing draftId in queue payload');
        if (String(q.channel) === 'LINKEDIN') {
          await this.sendApprovedLinkedin(q.draftId, 'admin');
        } else if (String(q.channel) === 'FACEBOOK') {
          await this.sendApprovedFacebook(q.draftId, 'admin');
        } else {
          throw new Error(`Unsupported queued channel: ${q.channel}`);
        }

        await this.prisma.outboundQueue.update({
          where: { id: q.id },
          data: {
            status: 'SENT',
            attemptCount: { increment: 1 },
            failureReason: null,
            metadata: { ...(q.metadata as any), lastResult: 'SENT', lastProcessedAt: new Date().toISOString() } as any,
            updatedAt: new Date(),
          } as any,
        });
        results.push({ queueId: q.id, status: 'sent' });
      } catch (e: any) {
        const err = String(e?.message || 'Queue execution failed');
        const nextAttempts = Number(q.attemptCount || 0) + 1;
        const maxAttempts = Number(q.maxAttempts || 3);
        const failureCode = classifyFailure(err);
        const retryable = failureCode === 'TRANSIENT' && nextAttempts < maxAttempts;

        await this.prisma.outboundQueue.update({
          where: { id: q.id },
          data: {
            status: retryable ? 'QUEUED' : 'FAILED',
            attemptCount: { increment: 1 },
            sendAfter: retryable ? new Date(Date.now() + 60 * 1000 * nextAttempts) : q.sendAfter,
            failureReason: `${failureCode}: ${err}`,
            metadata: {
              ...(q.metadata as any),
              lastResult: retryable ? 'REQUEUED' : 'FAILED',
              failureCode,
              retryable,
              lastProcessedAt: new Date().toISOString(),
            } as any,
            updatedAt: new Date(),
          } as any,
        });
        results.push({ queueId: q.id, status: retryable ? 'requeued' : 'failed', error: err, failureCode });
      }
    }

    await this.events.publish({ eventType: 'outbound.queue.processed', payload: { count: results.length, channel: channel || 'ALL' } });
    return { ok: true, processed: results.length, results };
  }

  async queueOverview() {
    const rows = await this.prisma.outboundQueue.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const byStatus = rows.reduce((acc: any, r: any) => {
      const s = String(r.status || 'UNKNOWN');
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      counts: {
        queued: byStatus.QUEUED || 0,
        sending: byStatus.SENDING || 0,
        sent: byStatus.SENT || 0,
        failed: byStatus.FAILED || 0,
      },
      recent: rows.slice(0, 20),
    };
  }

  async retryFailedQueueJob(id: string) {
    const row = await this.prisma.outboundQueue.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Queue job not found');
    if (String(row.status) !== 'FAILED') throw new BadRequestException('Only FAILED jobs can be retried');

    const reset = await this.prisma.outboundQueue.update({
      where: { id },
      data: {
        status: 'QUEUED',
        sendAfter: null,
        failureReason: null,
        metadata: { ...(row.metadata as any), manualRetryAt: new Date().toISOString() } as any,
      } as any,
    });

    await this.events.publish({ eventType: 'outbound.queue.retry_requested', payload: { queueId: id } });
    return { ok: true, queueId: reset.id, status: reset.status };
  }

  async listSendHistory(limit = 100) {
    const emailHistory = await this.listEmailSendHistory(limit);
    const li = await this.prisma.linkedinMessage.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    const linkedinHistory = li.map((m) => ({
      id: m.id,
      draftId: m.draftId,
      recipient: null,
      provider: 'LINKEDIN',
      status: m.status,
      timestamp: m.sentAt || m.createdAt,
      externalMessageId: m.externalThreadId || null,
      failureClassification: m.status === 'sent' ? null : m.status,
      replyStatus: m.replyReceivedAt ? 'Yes' : (m.status === 'sent' ? 'No' : 'Pending'),
    }));

    const merged = [...emailHistory.map((e: any) => ({ ...e, replyStatus: 'Pending' })), ...linkedinHistory]
      .sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, limit);
    return merged;
  }

  async markSentManual(id: string, actorRole: string) {
    if (actorRole !== 'admin') throw new BadRequestException('Admin only action');

    await this.settings.assertOutboundAllowed('linkedin');

    const draft = await this.prisma.draft.findUnique({ where: { id } });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.channel !== 'LINKEDIN') throw new BadRequestException('Manual mark sent is only enabled for LinkedIn drafts');
    if (draft.status !== DraftStatus.APPROVED) throw new BadRequestException('Draft must be approved before manual sent mark');

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedDraft = await tx.draft.update({ where: { id }, data: { status: 'SENT' as any } });
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
          metadata: { manual: true, channel: 'LINKEDIN', dryRun: false },
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
