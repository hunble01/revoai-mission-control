import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  list() {
    return this.prisma.agent.findMany({ orderBy: { name: 'asc' } });
  }

  async update(id: string, data: any) {
    const agent = await this.prisma.agent.update({ where: { id }, data });
    await this.events.publish({ eventType: 'agent.updated', agentId: id, payload: data });
    return agent;
  }
}
