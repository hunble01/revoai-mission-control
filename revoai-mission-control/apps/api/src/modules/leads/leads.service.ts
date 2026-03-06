import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

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

  update(id: string, data: any) {
    return this.prisma.lead.update({ where: { id }, data });
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

  async importMappedCsv(data: {
    campaignId?: string;
    headers: string[];
    rows: string[][];
    mapping: Record<string, 'name' | 'company' | 'email' | 'phone' | 'source' | ''>;
  }) {
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

    return {
      campaignId,
      imported,
      skippedDuplicates,
      invalidRows,
      totalRows: (data.rows || []).length,
      errorModel: {
        reasonCounts,
        rowIssues,
      },
    };
  }
}
