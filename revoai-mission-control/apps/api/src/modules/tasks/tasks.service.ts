import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

const allowedTaskTransitions: Record<string, string[]> = {
  BACKLOG: ['DOING'],
  DOING: ['NEEDS_APPROVAL', 'BACKLOG'],
  NEEDS_APPROVAL: ['DOING', 'DONE'],
  DONE: [],
};

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

  async update(id: string, data: any, actorRole: string) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Task not found');

    if (data.columnName && data.columnName !== existing.columnName) {
      const allowed = allowedTaskTransitions[existing.columnName] || [];
      if (!allowed.includes(data.columnName)) {
        throw new BadRequestException(`Invalid task transition ${existing.columnName} -> ${data.columnName}`);
      }
      if (data.columnName === 'DONE' && actorRole !== 'admin') {
        throw new BadRequestException('Only admin can mark task as DONE');
      }
    }

    const task = await this.prisma.task.update({ where: { id }, data });
    await this.events.publish({ eventType: 'task.updated', taskId: task.id, campaignId: task.campaignId ?? undefined, payload: data });
    await this.prisma.auditLog.create({
      data: {
        actorType: actorRole === 'admin' ? 'user' : 'agent',
        action: 'task.update',
        resourceType: 'task',
        resourceId: task.id,
        beforeState: { columnName: existing.columnName },
        afterState: { columnName: task.columnName },
        metadata: {},
      },
    });
    return task;
  }

  replay(id: string) {
    return this.prisma.taskEvent.findMany({ where: { taskId: id }, orderBy: { createdAt: 'asc' } });
  }
}
