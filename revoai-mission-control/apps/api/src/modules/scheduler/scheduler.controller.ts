import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { CreateSchedulerJobDto } from './dto/scheduler.dto';
import { assertAdminToken } from '../../common/auth.util';

@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly scheduler: SchedulerService) {}

  @Get('jobs')
  jobs(@Req() req: any) {
    assertAdminToken(req);
    return this.scheduler.listJobs();
  }

  @Post('jobs')
  createJob(@Req() req: any, @Body() body: CreateSchedulerJobDto) {
    assertAdminToken(req);
    return this.scheduler.createJob(body);
  }

  @Patch('jobs/:id')
  updateJob(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    return this.scheduler.updateJob(id, body);
  }

  @Post('jobs/:id/run-now')
  runNow(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    return this.scheduler.runNow(id);
  }

  @Get('runs')
  runs(@Req() req: any) {
    assertAdminToken(req);
    return this.scheduler.listRuns();
  }

  @Post('seed-defaults')
  seedDefaults(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    return this.scheduler.seedDefaultPipeline(body?.campaignId);
  }
}
