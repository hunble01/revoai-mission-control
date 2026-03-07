import { BadRequestException, Injectable } from '@nestjs/common';
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
    if (typeof data?.isActive === 'boolean') {
      const target = await this.prisma.campaign.findUnique({ where: { id }, select: { id: true, isActive: true } });
      if (!target) throw new BadRequestException('Campaign not found.');

      if (data.isActive) {
        await this.prisma.$transaction([
          this.prisma.campaign.updateMany({ data: { isActive: false } }),
          this.prisma.campaign.update({ where: { id }, data: { ...data, isActive: true } }),
        ]);
        const campaign = await this.prisma.campaign.findUnique({ where: { id } });
        await this.events.publish({ eventType: 'campaign.updated', campaignId: id, payload: { ...data, isActive: true } });
        return campaign;
      }

      const activeCount = await this.prisma.campaign.count({ where: { isActive: true } });
      if (target.isActive && activeCount <= 1) {
        throw new BadRequestException('At least one active campaign is required for lead ingestion.');
      }
    }

    const campaign = await this.prisma.campaign.update({ where: { id }, data });
    await this.events.publish({ eventType: 'campaign.updated', campaignId: id, payload: data });
    return campaign;
  }
}
