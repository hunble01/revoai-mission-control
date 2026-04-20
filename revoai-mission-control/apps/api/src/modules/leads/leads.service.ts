import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { Channel } from '@prisma/client';

/**
 * Generate RevoAI-brand-voice outreach copy tailored by channel + niche.
 * Rules pulled from REVOAI_PRODUCT_CONTEXT.md:
 *  - Email: 4-8 sentences, subject <50 chars, plain text preferred
 *  - LinkedIn DM: 2-4 sentences, observation-led
 *  - FB/IG DM: 1-3 sentences, lowercase-friendly, question-first
 *  - Single CTA, no "revolutionize/game-changer", no false claims,
 *    no review counts, no "no credit card required"
 */
function generateOutreachCopy(
  channel: string,
  lead: any,
  brand: any,
): { subject: string; content: string } {
  const contactName = String(lead?.contactName || '').trim().split(/\s+/)[0] || 'there';
  const businessName = String(lead?.businessName || 'your business').trim();
  const niche = String(lead?.niche || '').toLowerCase();
  const senderFirst = String(brand?.yourName || '').trim().split(/\s+/)[0] || 'Tony';

  // Niche-aware pain framing
  const painLine = (() => {
    if (/dent|ortho|med|vet|clinic/.test(niche)) {
      return `Most clinics miss 30–60% of calls — every unanswered ring is a patient booking with whoever answered first.`;
    }
    if (/hvac|plumb|electric|roof|contractor|gc/.test(niche)) {
      return `Emergency calls don't wait. A missed ring is usually a job booked with whoever picked up first.`;
    }
    if (/salon|barber|nail|spa|beauty/.test(niche)) {
      return `Missed calls = walk-ins at the next salon over. Local shops miss 30–60% of inbound calls, most of them after hours.`;
    }
    if (/law|legal|attorney/.test(niche)) {
      return `Prospective clients call one firm, then move on. Voicemail after hours usually means they're someone else's client by morning.`;
    }
    if (/gym|yoga|fitness|training/.test(niche)) {
      return `Trial-class calls don't leave a voicemail — they book with the first studio that picks up.`;
    }
    if (/clean|landscape|lawn/.test(niche)) {
      return `Quote calls are time-sensitive. If the phone goes to voicemail the lead is usually gone.`;
    }
    // default
    return `Most local service businesses miss 30–60% of calls — voicemail after hours, busy signal at peak times. Each missed call is a booking walking to the next result on Google.`;
  })();

  if (channel === 'EMAIL') {
    const subject = `Quick idea for ${businessName}`.slice(0, 50);
    const videoUrl = (process.env.DEMO_VIDEO_URL || '').trim();
    const demoLine = videoUrl
      ? `Here's a 90-second demo: ${videoUrl}`
      : '';
    const content = [
      `Hi ${contactName},`,
      ``,
      `${painLine}`,
      ``,
      `RevoAI is an AI receptionist built for businesses like ${businessName}. It answers every call in a real human voice, handles two-way SMS, and books straight into your calendar — all 24/7.`,
      ``,
      `You'll also get a live dashboard showing every call, text, and booking as it happens, plus an AI chatbox for your website that answers questions and captures leads while you sleep.`,
      ``,
      `Plans start at $97/mo CAD (vs. $2,500+ for a human receptionist). 7-day free trial, 10-minute setup, no contract.`,
      ``,
      demoLine,
      demoLine ? `` : null,
      `Take a look: https://revoai.ca/sign-up`,
      ``,
      `— ${senderFirst}`,
    ].filter((line) => line !== null).join('\n');
    return { subject, content };
  }

  if (channel === 'LINKEDIN') {
    // 2-4 sentences, observation-led, one soft CTA
    const content = [
      `Hi ${contactName},`,
      ``,
      `Saw ${businessName} — nice presence. Quick thought: most local shops miss 30–60% of calls, mostly after hours, and each one is usually a booking that went elsewhere.`,
      ``,
      `We built RevoAI to answer every call/text 24/7 and book straight into your calendar. $97/mo CAD vs. ~$2,500 for a human.`,
      ``,
      `Open to a 60-second look? https://revoai.ca`,
    ].join('\n');
    return { subject: '', content };
  }

  if (channel === 'FACEBOOK') {
    // 1-3 sentences, conversational
    const content = [
      `hey ${contactName} — saw ${businessName} online. quick question: are after-hours calls going to voicemail? we built an AI receptionist that answers every call 24/7 and books into your calendar for $97/mo. happy to show you: https://revoai.ca`,
    ].join('\n');
    return { subject: '', content };
  }

  // Fallback — same as email
  const subject = `Quick idea for ${businessName}`.slice(0, 50);
  const content = `Hi ${contactName},\n\n${painLine}\n\nRevoAI answers every call/text 24/7 and books into your calendar. $97/mo, 7-day free trial.\n\nhttps://revoai.ca\n\nThanks,\n${senderFirst}`;
  return { subject, content };
}

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  list(q?: { search?: string; status?: string }) {
    return this.prisma.lead.findMany({
      where: {
        status: q?.status as any || undefined,
        OR: q?.search
          ? [
              { businessName: { contains: q.search, mode: 'insensitive' } },
              { region: { contains: q.search, mode: 'insensitive' } },
              { niche: { contains: q.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  create(data: any) {
    return this.prisma.lead.create({ data });
  }

  async update(id: string, data: any, actorId?: string) {
    const before = await this.prisma.lead.findUnique({
      where: { id },
      select: { id: true, status: true, campaignId: true, updatedAt: true },
    });

    const updated = await this.prisma.lead.update({ where: { id }, data });

    if (before && typeof data?.status === 'string' && data.status !== before.status) {
      await this.prisma.auditLog.create({
        data: {
          actorType: 'user',
          actorId: actorId || null,
          action: 'lead.status.updated',
          resourceType: 'lead',
          resourceId: id,
          beforeState: { status: before.status },
          afterState: { status: updated.status },
          metadata: { campaignId: updated.campaignId },
        },
      });
    }

    return updated;
  }

  async overrideScore(id: string, score: 'A' | 'B' | 'C', reason: string) {
    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        scoreOverride: score,
        scoreOverrideReason: reason,
      },
    });

    await this.events.publish({
      eventType: 'lead.score.overridden',
      payload: { leadId: id, score, reason },
      campaignId: lead.campaignId,
    });

    return lead;
  }

  async enrichLead(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    const hunterApiKey = String(process.env.HUNTER_API_KEY || '').trim();
    let linkedinUrl: string | undefined;
    let phone: string | undefined;

    if (hunterApiKey && lead.website) {
      try {
        const domain = lead.website.replace(/^https?:\/\//, '').split('/')[0];
        const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(hunterApiKey)}`);
        const json: any = await res.json().catch(() => ({}));
        const emailRow = Array.isArray(json?.data?.emails) ? json.data.emails[0] : null;
        linkedinUrl = emailRow?.linkedin || undefined;
      } catch {
        // graceful fallback below
      }
    }

    if (!linkedinUrl) linkedinUrl = lead.linkedinUrl || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(lead.businessName)}`;
    if (!phone) phone = lead.phone || null as any;

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        linkedinUrl,
        phone,
        status: lead.status === 'NEW' ? 'ENRICHED' : lead.status,
      },
    });

    await this.events.publish({ eventType: 'lead.enriched', campaignId: updated.campaignId, payload: { leadId: updated.id } });
    return { ok: true, lead: updated };
  }

  async generateDraftForLead(id: string, body: any, actorId?: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    const channel = String(body?.channel || lead.preferredChannel || 'EMAIL').toUpperCase() as Channel;
    if (!['EMAIL', 'LINKEDIN', 'FACEBOOK'].includes(channel)) {
      throw new BadRequestException('Unsupported draft channel');
    }

    const campaignId = body?.campaignId || lead.campaignId;
    const brand = await this.prisma.brandSettings.findUnique({ where: { id: 'default' } });
    const generated = generateOutreachCopy(channel, lead, brand);
    const content = String(body?.content || generated.content).trim();
    const subject = channel === 'EMAIL' ? String(body?.subject || generated.subject) : null;

    const draft = await this.prisma.draft.create({
      data: {
        campaignId,
        leadId: lead.id,
        channel: channel as any,
        draftType: 'OUTREACH',
        status: 'NEEDS_APPROVAL' as any,
        subject,
        content,
        createdBy: actorId || null,
      } as any,
    });

    await this.prisma.draftVersion.create({
      data: {
        draftId: draft.id,
        versionNumber: 1,
        content,
        changeNote: 'Generated from lead profile',
        createdBy: actorId || null,
      },
    });

    await this.prisma.lead.update({ where: { id: lead.id }, data: { status: 'DRAFTED', lastActionAt: new Date() } as any });

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: actorId || null,
        action: 'lead.draft.generated',
        resourceType: 'lead',
        resourceId: lead.id,
        metadata: { draftId: draft.id, channel } as any,
      },
    });

    await this.events.publish({ eventType: 'lead.draft.generated', campaignId: lead.campaignId, payload: { leadId: lead.id, draftId: draft.id, channel } });
    return { ok: true, draftId: draft.id, status: draft.status };
  }

  async importMappedCsv(data: {
    campaignId?: string;
    fileName?: string;
    headers: string[];
    rows: string[][];
    mapping: Record<string, 'name' | 'company' | 'email' | 'phone' | 'source' | ''>;
  }, actorId?: string) {
    if (!Array.isArray(data?.headers) || !Array.isArray(data?.rows)) {
      throw new BadRequestException({
        code: 'INVALID_PAYLOAD',
        message: 'Invalid CSV payload: headers/rows must be arrays.',
        details: { field: 'headers|rows' },
      });
    }

    if (!data.headers.length) {
      throw new BadRequestException({
        code: 'MISSING_HEADERS',
        message: 'CSV headers are required.',
      });
    }

    const requiredMappings = new Set(Object.values(data.mapping || {}).filter(Boolean));
    if (!requiredMappings.has('name') && !requiredMappings.has('company')) {
      throw new BadRequestException({
        code: 'MISSING_REQUIRED_MAPPING',
        message: 'At least one column must map to name or company.',
        details: { required: ['name', 'company'] },
      });
    }

    const unknownMappedHeaders = Object.keys(data.mapping || {}).filter((h) => !data.headers.includes(h));
    if (unknownMappedHeaders.length) {
      throw new BadRequestException({
        code: 'UNKNOWN_MAPPED_HEADER',
        message: `CSV mapping references unknown headers: ${unknownMappedHeaders.join(', ')}`,
        details: { unknownMappedHeaders },
      });
    }

    if ((data.rows || []).length > 5000) {
      throw new BadRequestException({
        code: 'ROW_LIMIT_EXCEEDED',
        message: 'CSV import exceeds 5000-row limit for a single run.',
        details: { maxRows: 5000, receivedRows: (data.rows || []).length },
      });
    }

    const campaignId =
      data.campaignId ||
      (
        await this.prisma.campaign.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })
      )?.id;

    if (!campaignId) {
      throw new BadRequestException({
        code: 'CAMPAIGN_REQUIRED',
        message: 'No campaign available for lead ingestion.',
      });
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { name: true, isActive: true },
    });

    if (!campaign) {
      throw new BadRequestException({
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Selected campaign was not found.',
      });
    }

    if (!campaign.isActive) {
      throw new BadRequestException({
        code: 'CAMPAIGN_INACTIVE',
        message: 'Selected campaign is inactive and cannot receive imports.',
      });
    }
    const existing = await this.prisma.lead.findMany({
      where: { campaignId },
      select: { email: true, phone: true },
    });

    const seenEmails = new Set(existing.map((l) => (l.email || '').trim().toLowerCase()).filter(Boolean));
    const seenPhones = new Set(existing.map((l) => (l.phone || '').replace(/\D+/g, '')).filter(Boolean));

    let imported = 0;
    let skippedDuplicates = 0;
    let invalidRows = 0;

    const reasonCounts: Record<string, number> = {
      INVALID_ROW_SHAPE: 0,
      MISSING_IDENTITY: 0,
      MISSING_CONTACT: 0,
      DUPLICATE: 0,
      WRITE_FAILED: 0,
    };
    const rowIssues: Array<{ rowNumber: number; code: string; reason: string }> = [];

    for (let rowIndex = 0; rowIndex < (data.rows || []).length; rowIndex++) {
      const row = data.rows[rowIndex];
      const rowNumber = rowIndex + 2;
      if (!Array.isArray(row) || row.length > data.headers.length + 20) {
        invalidRows += 1;
        reasonCounts.INVALID_ROW_SHAPE += 1;
        if (rowIssues.length < 25) rowIssues.push({ rowNumber, code: 'INVALID_ROW_SHAPE', reason: 'Row shape is invalid.' });
        continue;
      }

      const mapped: Record<string, string> = {};

      for (let i = 0; i < data.headers.length; i++) {
        const sourceHeader = data.headers[i];
        const targetField = data.mapping?.[sourceHeader];
        if (!targetField) continue;
        mapped[targetField] = (row[i] || '').trim();
      }

      const businessName = (mapped.company || mapped.name || '').trim();
      const email = mapped.email ? mapped.email.trim().toLowerCase() : null;
      const phone = mapped.phone ? mapped.phone.replace(/\D+/g, '') : null;
      const source = (mapped.source || 'csv-import').trim();

      if (!businessName) {
        invalidRows += 1;
        reasonCounts.MISSING_IDENTITY += 1;
        if (rowIssues.length < 25) rowIssues.push({ rowNumber, code: 'MISSING_IDENTITY', reason: 'Missing Name/Company.' });
        continue;
      }

      if (!email && !phone) {
        invalidRows += 1;
        reasonCounts.MISSING_CONTACT += 1;
        if (rowIssues.length < 25) rowIssues.push({ rowNumber, code: 'MISSING_CONTACT', reason: 'Missing Email/Phone.' });
        continue;
      }

      const duplicate = !!(
        (email && seenEmails.has(email)) ||
        (phone && seenPhones.has(phone))
      );

      if (duplicate) {
        skippedDuplicates += 1;
        reasonCounts.DUPLICATE += 1;
        if (rowIssues.length < 25) rowIssues.push({ rowNumber, code: 'DUPLICATE', reason: 'Duplicate email/phone in campaign.' });
        continue;
      }

      try {
        await this.prisma.lead.create({
          data: {
            campaignId,
            businessName,
            contactName: mapped.name || null,
            email,
            phone,
            source,
            status: 'NEW',
          },
        });

        if (email) seenEmails.add(email);
        if (phone) seenPhones.add(phone);
        imported += 1;
      } catch {
        invalidRows += 1;
        reasonCounts.WRITE_FAILED += 1;
        if (rowIssues.length < 25) rowIssues.push({ rowNumber, code: 'WRITE_FAILED', reason: 'Database write failed.' });
      }
    }

    const result = {
      campaignId,
      campaignName: campaign?.name || 'Unknown campaign',
      fileName: data.fileName || 'csv-import',
      imported,
      skippedDuplicates,
      invalidRows,
      totalRows: (data.rows || []).length,
      errorModel: {
        reasonCounts,
        rowIssues,
      },
    };

    await this.prisma.auditLog.create({
      data: {
        actorType: 'user',
        actorId: actorId || null,
        action: 'lead.import.csv',
        resourceType: 'lead_import_run',
        resourceId: campaignId,
        metadata: result as any,
      },
    });

    return result;
  }

  async listImportRuns(limit = 10) {
    const take = Math.min(Math.max(Number.isFinite(limit) ? Number(limit) : 10, 1), 50);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        action: 'lead.import.csv',
        resourceType: 'lead_import_run',
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        createdAt: true,
        actorId: true,
        resourceId: true,
        metadata: true,
      },
    });

    return rows.map((r) => ({
      id: String(r.id),
      createdAt: r.createdAt,
      actorId: r.actorId,
      campaignId: r.resourceId,
      ...(r.metadata as Record<string, any>),
    }));
  }
}
