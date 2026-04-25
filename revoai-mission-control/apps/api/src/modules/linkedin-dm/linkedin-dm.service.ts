import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { SettingsService } from '../settings/settings.service';
import { UnsubscribeService } from '../unsubscribe/unsubscribe.service';

@Injectable()
export class LinkedinDmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly settings: SettingsService,
    private readonly unsubscribe: UnsubscribeService,
  ) {}

  queue() {
    return this.prisma.linkedinMessage.findMany({ where: { status: { in: ['queued', 'approved'] as any } as any }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  history() {
    return this.prisma.linkedinMessage.findMany({ where: { status: { in: ['sent', 'replied', 'failed', 'rejected'] as any } as any }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  enqueue(body: any) {
    return this.prisma.linkedinMessage.create({
      data: {
        leadId: body?.leadId || null,
        draftId: body?.draftId || null,
        messageBody: String(body?.messageBody || body?.content || '').trim(),
        status: body?.status || 'queued',
      },
    });
  }

  async send(id: string) {
    await this.settings.assertOutboundAllowed('linkedin');

    const msg = await this.prisma.linkedinMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('LinkedIn message not found');
    if (!['approved'].includes(String(msg.status))) throw new BadRequestException('Message must be approved before send');

    // Cross-channel suppression: if the lead was unsubscribed via email, never DM them on LinkedIn.
    if (msg.leadId) {
      const lead = await this.prisma.lead.findUnique({ where: { id: msg.leadId } });
      if (lead?.email) {
        const suppressed = await this.unsubscribe.isSuppressed(lead.email);
        if (suppressed) {
          await this.prisma.linkedinMessage.update({ where: { id }, data: { status: 'rejected' } });
          throw new BadRequestException('Lead is on the suppression list — DM auto-rejected');
        }
      }
    }

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const usedToday = await this.prisma.linkedinMessage.count({ where: { status: 'sent', sentAt: { gte: start, lt: end } } as any });
    if (usedToday >= 20) throw new BadRequestException('LinkedIn DM daily limit reached (20/day)');

    const stub = String(process.env.LINKEDIN_DM_STUB_MODE || '1') !== '0';
    let externalThreadId = `li_dm_stub_${Date.now()}`;

    if (!stub) {
      const unipileUrl = process.env.UNIPILE_DM_SEND_URL || '';
      const unipileKey = process.env.UNIPILE_API_KEY || '';
      if (!unipileUrl || !unipileKey) throw new BadRequestException('Unipile DM config missing');
      const res = await fetch(unipileUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${unipileKey}` },
        body: JSON.stringify({ text: msg.messageBody, leadId: msg.leadId, draftId: msg.draftId }),
      });
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new BadRequestException(j?.message || `LinkedIn DM send failed (${res.status})`);
      externalThreadId = j?.threadId || externalThreadId;
    }

    const updated = await this.prisma.linkedinMessage.update({ where: { id }, data: { status: 'sent', sentAt: new Date(), externalThreadId } });
    await this.prisma.auditLog.create({ data: { actorType: 'user', action: 'linkedin_dm.sent', resourceType: 'linkedin_message', resourceId: id, metadata: { externalThreadId } as any } as any });
    await this.events.publish({ eventType: 'LINKEDIN_DM_SENT', payload: { id: updated.id } });
    return updated;
  }

  async approve(id: string) {
    const msg = await this.prisma.linkedinMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('LinkedIn message not found');
    if (String(msg.status) !== 'queued') throw new BadRequestException('Only queued messages can be approved');
    const updated = await this.prisma.linkedinMessage.update({ where: { id }, data: { status: 'approved' } });
    await this.prisma.auditLog.create({ data: { actorType: 'user', action: 'linkedin_dm.approved', resourceType: 'linkedin_message', resourceId: id } as any });
    return updated;
  }

  async reject(id: string) {
    const msg = await this.prisma.linkedinMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('LinkedIn message not found');
    const updated = await this.prisma.linkedinMessage.update({ where: { id }, data: { status: 'rejected' } });
    await this.prisma.auditLog.create({ data: { actorType: 'user', action: 'linkedin_dm.rejected', resourceType: 'linkedin_message', resourceId: id } as any });
    return updated;
  }
}
