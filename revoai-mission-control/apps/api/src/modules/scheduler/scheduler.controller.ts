import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly scheduler: SchedulerService) {}

  @Get('jobs')
  jobs() {
    return this.scheduler.listJobs();
  }

  @Post('jobs')
  createJob(@Body() body: any) {
    return this.scheduler.createJob(body);
  }

  @Patch('jobs/:id')
  updateJob(@Param('id') id: string, @Body() body: any) {
    return this.scheduler.updateJob(id, body);
  }

  @Post('jobs/:id/run-now')
  runNow(@Param('id') id: string) {
    return this.scheduler.runNow(id);
  }

  @Get('runs')
  runs() {
    return this.scheduler.listRuns();
  }

  @Post('seed-defaults')
  seedDefaults(@Body() body: any) {
    return this.scheduler.seedDefaultPipeline(body?.campaignId);
  }
}
