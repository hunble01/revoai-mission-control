import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  list() {
    return this.prisma.task.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async create(data: any) {
    const task = await this.prisma.task.create({ data });
    await this.events.publish({ eventType: 'task.created', taskId: task.id, campaignId: task.campaignId ?? undefined, payload: task });
    return task;
  }

  async update(id: string, data: any) {
    const task = await this.prisma.task.update({ where: { id }, data });
    await this.events.publish({ eventType: 'task.updated', taskId: task.id, campaignId: task.campaignId ?? undefined, payload: data });
    return task;
  }

  replay(id: string) {
    return this.prisma.taskEvent.findMany({ where: { taskId: id }, orderBy: { createdAt: 'asc' } });
  }
}
