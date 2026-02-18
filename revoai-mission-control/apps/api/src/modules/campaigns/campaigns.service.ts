import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  list() {
    return this.prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(data: any) {
    const campaign = await this.prisma.campaign.create({
      data: {
        name: data.name,
        niche: data.niche,
        geography: data.geography,
        minScore: data.minScore ?? 'B',
        outreachTemplates: data.outreachTemplates ?? {},
        contentThemes: data.contentThemes ?? [],
        metrics: data.metrics ?? {},
      },
    });
    await this.events.publish({ eventType: 'campaign.created', campaignId: campaign.id, payload: campaign });
    return campaign;
  }

  async update(id: string, data: any) {
    const campaign = await this.prisma.campaign.update({ where: { id }, data });
    await this.events.publish({ eventType: 'campaign.updated', campaignId: id, payload: data });
    return campaign;
  }
}
