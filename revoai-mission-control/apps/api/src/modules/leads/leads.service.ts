import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  list() {
    return this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
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
}
