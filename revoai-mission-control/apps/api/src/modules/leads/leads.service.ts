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
    const requiredMappings = new Set(Object.values(data.mapping || {}).filter(Boolean));
    if (!requiredMappings.has('name') && !requiredMappings.has('company')) {
      throw new BadRequestException('At least one column must map to name or company.');
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
      throw new BadRequestException('No campaign available for lead ingestion.');
    }

    let imported = 0;
    let skippedDuplicates = 0;
    let invalidRows = 0;

    for (const row of data.rows || []) {
      const mapped: Record<string, string> = {};

      for (let i = 0; i < data.headers.length; i++) {
        const sourceHeader = data.headers[i];
        const targetField = data.mapping?.[sourceHeader];
        if (!targetField) continue;
        mapped[targetField] = (row[i] || '').trim();
      }

      const businessName = mapped.company || mapped.name || '';
      const email = mapped.email || null;
      const phone = mapped.phone || null;
      const source = mapped.source || 'csv-import';

      if (!businessName || (!email && !phone)) {
        invalidRows += 1;
        continue;
      }

      const duplicate = await this.prisma.lead.findFirst({
        where: {
          campaignId,
          OR: [
            ...(email ? [{ email }] : []),
            ...(phone ? [{ phone }] : []),
          ],
        },
        select: { id: true },
      });

      if (duplicate) {
        skippedDuplicates += 1;
        continue;
      }

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

      imported += 1;
    }

    return {
      campaignId,
      imported,
      skippedDuplicates,
      invalidRows,
      totalRows: (data.rows || []).length,
    };
  }
}
