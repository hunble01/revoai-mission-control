import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class SchedulerService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  listJobs() {
    return this.prisma.schedulerJob.findMany({ orderBy: { createdAt: 'asc' } });
  }

  createJob(data: any) {
    return this.prisma.schedulerJob.create({ data });
  }

  updateJob(id: string, data: any) {
    return this.prisma.schedulerJob.update({ where: { id }, data });
  }

  listRuns() {
    return this.prisma.schedulerRun.findMany({ orderBy: { startedAt: 'desc' }, take: 100 });
  }

  async runNow(id: string) {
    const job = await this.prisma.schedulerJob.findUnique({ where: { id } });
    if (!job) throw new Error('Job not found');

    await this.events.publish({ eventType: 'scheduler.job.started', payload: { jobId: id, jobName: job.name } });

    const run = await this.prisma.schedulerRun.create({
      data: { jobId: id, status: 'running', summary: {} },
    });

    // MVP dry-run behavior: generate events only, no external send.
    await this.events.publish({
      eventType: 'scheduler.job.completed',
      payload: { jobId: id, runId: run.id, dryRun: true },
    });

    return this.prisma.schedulerRun.update({
      where: { id: run.id },
      data: { status: 'completed', finishedAt: new Date(), summary: { dryRun: true } },
    });
  }

  async seedDefaultPipeline(campaignId?: string) {
    const defaults = [
      { name: '09:00 Lead Research', cronExpr: '0 9 * * *' },
      { name: '09:30 Enrichment + scoring', cronExpr: '30 9 * * *' },
      { name: '10:30 Outreach Drafting + QA', cronExpr: '30 10 * * *' },
      { name: '12:00 Content Research + Creation + QA', cronExpr: '0 12 * * *' },
      { name: '16:30 Daily Brief', cronExpr: '30 16 * * *' },
    ];

    const created = [];
    for (const d of defaults) {
      created.push(await this.prisma.schedulerJob.create({
        data: {
          campaignId,
          name: d.name,
          cronExpr: d.cronExpr,
          timezone: 'America/Toronto',
          enabled: true,
          config: {},
        },
      }));
    }
    return created;
  }
}
