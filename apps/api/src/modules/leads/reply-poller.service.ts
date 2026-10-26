import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { UnsubscribeService } from '../unsubscribe/unsubscribe.service';
import { FollowUpService } from './followup.service';

/**
 * Reads the cold outreach mailbox (COLD_SMTP_USER over IMAP) so replies and
 * bounces feed back into the pipeline instead of sitting unseen:
 *
 *   reply        → lead REPLIED, follow-up sequence stopped, any pending
 *                  outreach drafts for the lead rejected
 *   "remove me"  → same, plus the address is suppressed
 *   bounce       → failed recipient suppressed, send marked bounced
 *   auto-reply   → ignored (out-of-office shouldn't stop a sequence)
 *
 * Messages are only read (never flagged/moved) so the mailbox still looks
 * untouched in webmail. Progress is tracked by IMAP UID in the Setting table.
 */

const STATE_KEY = 'cold_inbox_state';
const POLL_MS = 5 * 60 * 1000;
const OPT_OUT = /\b(unsubscribe|remove me|take me off|stop (emailing|contacting|sending)|do not (email|contact)|don'?t (email|contact))\b/i;
const AUTO_SUBJECT = /^(automatic reply|auto(matic)?[- ]?reply|out of (the )?office|away from|on vacation|autoreply)/i;
const BOUNCE_FROM = /(mailer-daemon|postmaster|mail delivery (subsystem|system))/i;

type InboxState = { uidValidity: string; lastUid: number };

@Injectable()
export class ReplyPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('ReplyPoller');
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly unsubscribe: UnsubscribeService,
    private readonly followUp: FollowUpService,
  ) {}

  onModuleInit() {
    if (!process.env.COLD_IMAP_HOST || !process.env.COLD_SMTP_USER || !process.env.COLD_SMTP_PASS) {
      this.log.log('cold inbox not configured (COLD_IMAP_HOST / COLD_SMTP_USER / COLD_SMTP_PASS) — reply polling off');
      return;
    }
    setTimeout(() => this.safeRun(), 20_000);
    this.timer = setInterval(() => this.safeRun(), POLL_MS);
    this.log.log(`reply polling enabled for ${process.env.COLD_SMTP_USER} — every ${POLL_MS / 60000}m`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async safeRun() {
    if (this.running) return;
    this.running = true;
    try {
      const s = await this.poll();
      if (s.scanned) this.log.log(`scanned=${s.scanned} replies=${s.replies} optOuts=${s.optOuts} bounces=${s.bounces} autoReplies=${s.autoReplies} unmatched=${s.unmatched}`);
    } catch (err: any) {
      this.log.error(`poll failed: ${err?.message || err}`);
    } finally {
      this.running = false;
    }
  }

  async poll() {
    const summary = { scanned: 0, replies: 0, optOuts: 0, bounces: 0, autoReplies: 0, unmatched: 0 };
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ImapFlow } = require('imapflow');
    const client = new ImapFlow({
      host: process.env.COLD_IMAP_HOST,
      port: Number(process.env.COLD_IMAP_PORT || 993),
      secure: true,
      auth: { user: process.env.COLD_SMTP_USER, pass: process.env.COLD_SMTP_PASS },
      logger: false,
    });
    await client.connect();
    const lock = await client.getMailboxLock('INBOX', { readOnly: true });
    try {
      const mailbox: any = client.mailbox;
      const uidValidity = String(mailbox?.uidValidity ?? '');
      const nextUid = Number(mailbox?.uidNext ?? 1);
      const saved = await this.getState();

      // First run (or mailbox reset): start from now — don't replay history.
      if (!saved || saved.uidValidity !== uidValidity) {
        await this.setState({ uidValidity, lastUid: nextUid - 1 });
        return summary;
      }
      if (nextUid - 1 <= saved.lastUid) return summary;

      let lastUid = saved.lastUid;
      for await (const msg of client.fetch(
        `${saved.lastUid + 1}:*`,
        { uid: true, envelope: true, headers: ['references', 'auto-submitted', 'x-autoreply', 'x-autorespond', 'content-type', 'precedence'], source: { maxLength: 200_000 } },
        { uid: true },
      )) {
        if (msg.uid <= saved.lastUid) continue; // "N:*" always returns at least the last message
        summary.scanned += 1;
        try {
          const kind = await this.handleMessage(msg);
          (summary as any)[kind] += 1;
        } catch (err: any) {
          this.log.warn(`uid ${msg.uid}: ${err?.message || err}`);
        }
        lastUid = Math.max(lastUid, msg.uid);
      }
      await this.setState({ uidValidity, lastUid });
    } finally {
      lock.release();
      await client.logout().catch(() => {});
    }
    return summary;
  }

  private async handleMessage(msg: any): Promise<'replies' | 'optOuts' | 'bounces' | 'autoReplies' | 'unmatched'> {
    const env = msg.envelope || {};
    const fromAddr = String(env.from?.[0]?.address || '').toLowerCase();
    const subject = String(env.subject || '');
    const headers = String(msg.headers?.toString() || '');
    const source = String(msg.source?.toString() || '');

    // ---- Bounces (DSN) ----
    if (BOUNCE_FROM.test(fromAddr) || BOUNCE_FROM.test(String(env.from?.[0]?.name || '')) || /report-type=["']?delivery-status/i.test(headers)) {
      const recipients = new Set<string>();
      for (const m of source.matchAll(/(?:Final|Original)-Recipient:\s*rfc822;\s*<?([^\s<>;]+@[^\s<>;]+)>?/gi)) recipients.add(m[1].toLowerCase());
      const coldUser = String(process.env.COLD_SMTP_USER || '').toLowerCase();
      recipients.delete(coldUser);
      for (const r of recipients) {
        await this.unsubscribe.suppress(r, 'BOUNCED', 'cold-inbox', `Bounce: ${subject.slice(0, 120)}`);
        const lead = await this.prisma.lead.findFirst({ where: { email: { equals: r, mode: 'insensitive' } }, orderBy: { lastOutboundAt: 'desc' } });
        if (lead) {
          const lastSend = await this.prisma.outboundSend.findFirst({ where: { provider: 'EMAIL', leadId: lead.id }, orderBy: { sentAt: 'desc' } });
          if (lastSend) await this.prisma.outboundSend.update({ where: { id: lastSend.id }, data: { status: 'bounced' } });
          await this.followUp.pauseSequence(lead.id, 'unsubscribed');
        }
        await this.events.publish({ eventType: 'delivery.bounced', payload: { email: r, leadId: lead?.id || null, via: 'cold-inbox' } });
      }
      return recipients.size ? 'bounces' : 'unmatched';
    }

    // ---- Auto-replies ----
    const autoSubmitted = /^auto-submitted:\s*(?!no\b)\S+/im.test(headers);
    if (autoSubmitted || /^x-auto(reply|respond)/im.test(headers) || /^precedence:\s*(auto_reply|bulk|junk)/im.test(headers) || AUTO_SUBJECT.test(subject)) {
      return 'autoReplies';
    }

    // ---- Real replies: match by thread headers first, then sender address ----
    const refs = [env.inReplyTo, ...(headers.match(/<[^<>\s]+@[^<>\s]+>/g) || [])].filter(Boolean) as string[];
    let leadId: string | null = null;
    if (refs.length) {
      const send = await this.prisma.outboundSend.findFirst({ where: { provider: 'EMAIL', externalMessageId: { in: refs } }, orderBy: { sentAt: 'desc' } });
      leadId = send?.leadId || null;
    }
    if (!leadId && fromAddr) {
      const lead = await this.prisma.lead.findFirst({
        where: { email: { equals: fromAddr, mode: 'insensitive' }, lastOutboundAt: { not: null } },
        orderBy: { lastOutboundAt: 'desc' },
      });
      leadId = lead?.id || null;
    }
    if (!leadId) return 'unmatched';

    const snippet = this.replyText(source).slice(0, 500);
    const optOut = OPT_OUT.test(`${subject}\n${snippet}`);

    await this.followUp.pauseSequence(leadId, optOut ? 'unsubscribed' : 'replied');
    if (optOut && fromAddr) await this.unsubscribe.suppress(fromAddr, 'UNSUBSCRIBE', 'reply', snippet.slice(0, 200));

    // No accidental follow-up after they've answered
    await this.prisma.draft.updateMany({
      where: { leadId, channel: 'EMAIL' as any, status: { in: ['DRAFT', 'NEEDS_APPROVAL', 'APPROVED'] as any } },
      data: { status: 'REJECTED' as any },
    });

    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    const notes = Array.isArray(lead?.notes) ? (lead!.notes as any[]) : [];
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { notes: [...notes, { type: optOut ? 'opt_out' : 'reply', at: new Date().toISOString(), from: fromAddr, subject, snippet }] as any },
    });

    await this.events.publish({
      eventType: optOut ? 'lead.opted_out' : 'lead.replied',
      campaignId: lead?.campaignId,
      payload: { leadId, businessName: lead?.businessName, from: fromAddr, subject, snippet: snippet.slice(0, 200) },
    });
    return optOut ? 'optOuts' : 'replies';
  }

  // Rough plain-text extraction of the new part of a reply: first text/plain
  // section, quoted history ("On ... wrote:", "> ") cut off.
  private replyText(source: string): string {
    const bodyStart = source.search(/\r?\n\r?\n/);
    let body = bodyStart >= 0 ? source.slice(bodyStart) : source;
    const plain = body.match(/content-type:\s*text\/plain[^\n]*\n(?:[^\n]+\n)*?\r?\n([\s\S]*?)(?:\r?\n--[^\n]+|$)/i);
    if (plain) body = plain[1];
    if (/content-transfer-encoding:\s*quoted-printable/i.test(source)) {
      body = body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    }
    const cut = body.search(/^(On .+wrote:|-{2,} ?Original Message|From: .+)$/im);
    if (cut > 0) body = body.slice(0, cut);
    return body
      .split(/\r?\n/)
      .filter((l) => !l.startsWith('>'))
      .join('\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async getState(): Promise<InboxState | null> {
    const row = await this.prisma.setting.findUnique({ where: { key: STATE_KEY } });
    return (row?.value as any) || null;
  }

  private async setState(state: InboxState) {
    await this.prisma.setting.upsert({
      where: { key: STATE_KEY },
      update: { value: state as any, updatedAt: new Date() },
      create: { key: STATE_KEY, value: state as any },
    });
  }
}
