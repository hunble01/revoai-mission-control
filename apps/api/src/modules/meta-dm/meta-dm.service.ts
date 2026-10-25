import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

// Facebook + Instagram DM queue. Stub-only by default — Meta enforces a
// 24-hour reply window (DMs only allowed after a user contacts the page
// first), so cold-DM automation isn't a viable path here. The /social DMs
// tab surfaces a banner explaining this. The "real send" path is gated
// behind a stub flag that stays on until a validated path exists.

const ALLOWED_CHANNELS = new Set(['FACEBOOK', 'INSTAGRAM']);

@Injectable()
export class MetaDmService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  async queue(channel?: string) {
    const where: any = { status: { in: ['queued', 'approved'] as any } };
    if (channel && ALLOWED_CHANNELS.has(channel.toUpperCase())) where.channel = channel.toUpperCase();
    return (this.prisma as any).metaMessage.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async history(channel?: string) {
    const where: any = { status: { in: ['sent', 'replied', 'rejected', 'failed'] as any } };
    if (channel && ALLOWED_CHANNELS.has(channel.toUpperCase())) where.channel = channel.toUpperCase();
    return (this.prisma as any).metaMessage.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async enqueue(body: any) {
    const channel = String(body?.channel || '').toUpperCase();
    if (!ALLOWED_CHANNELS.has(channel)) throw new BadRequestException('channel must be FACEBOOK or INSTAGRAM');
    const messageBody = String(body?.messageBody || body?.content || '').trim();
    if (!messageBody) throw new BadRequestException('messageBody required');

    const created = await (this.prisma as any).metaMessage.create({
      data: {
        channel,
        leadId: body?.leadId || null,
        recipientHandle: body?.recipientHandle || null,
        messageBody,
        status: 'queued',
      },
    });

    await this.events.publish({ eventType: 'META_DM_QUEUED', payload: { id: created.id, channel } });
    return created;
  }

  async approve(id: string) {
    const msg = await (this.prisma as any).metaMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('Meta message not found');
    if (String(msg.status) !== 'queued') throw new BadRequestException('Only queued messages can be approved');
    return (this.prisma as any).metaMessage.update({ where: { id }, data: { status: 'approved' } });
  }

  async reject(id: string, reason?: string) {
    const msg = await (this.prisma as any).metaMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('Meta message not found');
    return (this.prisma as any).metaMessage.update({
      where: { id },
      data: { status: 'rejected', rejectReason: reason ? String(reason).slice(0, 200) : null },
    });
  }

  /**
   * "Send" — stub-only by default. Real sending requires Messenger Platform
   * + a valid 24h reply window which we cannot programmatically verify, so
   * the user is expected to send manually from the Pages inbox after
   * approving in this queue. We mark sent here for tracking and audit.
   */
  async send(id: string) {
    const msg = await (this.prisma as any).metaMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('Meta message not found');
    if (String(msg.status) !== 'approved') throw new BadRequestException('Message must be approved before send');

    const stub = String(process.env.META_DM_STUB_MODE || '1') !== '0';
    let externalThreadId = `${String(msg.channel).toLowerCase()}_dm_stub_${Date.now()}`;

    if (!stub) {
      // Real send path is intentionally not wired — Meta DM platforms
      // require a 24h reply window we can't verify programmatically.
      // When the user proves a viable path, replace this branch.
      throw new BadRequestException('Real Meta DM send not wired — keep META_DM_STUB_MODE=1 and send manually from Pages inbox.');
    }

    const updated = await (this.prisma as any).metaMessage.update({
      where: { id },
      data: { status: 'sent', sentAt: new Date(), externalThreadId },
    });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        action: 'meta_dm.sent',
        resourceType: 'meta_message',
        resourceId: id,
        metadata: { channel: msg.channel, externalThreadId, stub: true } as any,
      },
    });

    await this.events.publish({ eventType: 'META_DM_SENT', payload: { id: updated.id, channel: msg.channel } });
    return updated;
  }
}
