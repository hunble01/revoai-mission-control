import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class DraftsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  list() {
    return this.prisma.draft.findMany({ include: { versions: true }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async create(data: any) {
    const draft = await this.prisma.draft.create({
      data: {
        campaignId: data.campaignId,
        leadId: data.leadId,
        channel: data.channel,
        draftType: data.draftType,
        createdBy: data.createdBy,
      },
    });
    await this.prisma.draftVersion.create({
      data: {
        draftId: draft.id,
        versionNumber: 1,
        content: data.content ?? '',
        changeNote: 'Initial draft',
      },
    });
    await this.events.publish({ eventType: 'draft.created', campaignId: draft.campaignId, payload: { draftId: draft.id } });
    return draft;
  }

  async update(id: string, data: any) {
    const current = await this.prisma.draft.findUnique({ where: { id } });
    if (!current) throw new Error('Draft not found');

    if (data.content) {
      await this.prisma.draftVersion.create({
        data: {
          draftId: id,
          versionNumber: current.currentVersion + 1,
          content: data.content,
          changeNote: data.changeNote ?? 'Updated draft',
        },
      });
      data.currentVersion = current.currentVersion + 1;
    }

    const updated = await this.prisma.draft.update({ where: { id }, data });
    await this.events.publish({ eventType: 'draft.updated', campaignId: updated.campaignId, payload: { draftId: id } });
    return updated;
  }
}
