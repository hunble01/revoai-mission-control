import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from './events.gateway';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
  ) {}

  async publish(event: {
    eventType: string;
    taskId?: string;
    campaignId?: string;
    agentId?: string;
    payload?: any;
    createdBy?: string;
  }) {
    const row = await this.prisma.taskEvent.create({
      data: {
        eventType: event.eventType,
        taskId: event.taskId,
        campaignId: event.campaignId,
        agentId: event.agentId,
        payload: event.payload ?? {},
        createdBy: event.createdBy,
      },
    });

    this.gateway.emitEvent({
      id: row.id.toString(),
      type: event.eventType,
      taskId: event.taskId,
      campaignId: event.campaignId,
      agentId: event.agentId,
      payload: event.payload ?? {},
      timestamp: row.createdAt,
    });

    return row;
  }
}
