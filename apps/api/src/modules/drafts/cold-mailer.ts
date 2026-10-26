// -------- Cold outreach mailbox (IONOS) --------
//
// Cold email goes out from a real mailbox on a separate domain
// (michael.west@revoai.info) instead of Resend, so revoai.ca's reputation
// and Resend's transactional sending stay isolated from outreach. Replies
// and bounces land back in this same mailbox, where ReplyPollerService
// reads them over IMAP.
//
// Messages are plain text — 1:1 cold email that looks like a person wrote
// it lands in Primary far more often than branded HTML.

import { randomUUID } from 'crypto';

export function coldMailerConfigured(): boolean {
  return !!(process.env.COLD_SMTP_HOST && process.env.COLD_SMTP_USER && process.env.COLD_SMTP_PASS);
}

export function coldFromAddress(): string {
  return String(process.env.COLD_SMTP_USER || '').trim();
}

export function newColdMessageId(): string {
  const domain = coldFromAddress().split('@')[1] || 'localhost';
  return `<${randomUUID()}@${domain}>`;
}

export async function sendColdEmail(opts: {
  from: string;
  to: string;
  subject: string;
  text: string;
  messageId: string;
  inReplyTo?: string | null;
  references?: string[];
  headers?: Record<string, string>;
}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodemailer = require('nodemailer');
  const port = Number(process.env.COLD_SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.COLD_SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.COLD_SMTP_USER, pass: process.env.COLD_SMTP_PASS },
  });

  const mail: any = {
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    messageId: opts.messageId,
    headers: opts.headers || {},
  };
  if (opts.inReplyTo) mail.inReplyTo = opts.inReplyTo;
  if (opts.references?.length) mail.references = opts.references;

  await transporter.sendMail(mail);

  // Best effort: keep a copy in the mailbox's Sent folder so replies can be
  // answered in-thread from webmail. Never fail the send over this.
  saveToSentFolder(mail).catch((err) => console.warn('[cold-mailer] save to Sent failed:', err?.message || err));
}

async function saveToSentFolder(mail: any) {
  if (!process.env.COLD_IMAP_HOST) return;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const MailComposer = require('nodemailer/lib/mail-composer');
  const raw: Buffer = await new MailComposer({ ...mail, keepBcc: true }).compile().build();

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
  try {
    const boxes: any[] = await client.list();
    const sent = boxes.find((b) => b.specialUse === '\\Sent') || boxes.find((b) => /^sent( items)?$/i.test(b.path));
    if (sent) await client.append(sent.path, raw, ['\\Seen']);
  } finally {
    await client.logout().catch(() => {});
  }
}
