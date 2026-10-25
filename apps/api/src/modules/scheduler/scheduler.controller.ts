import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { CreateSchedulerJobDto } from './dto/scheduler.dto';
import { assertAdminToken, assertAdminRole, getActorRole } from '../../common/auth.util';

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
    assertAdminRole(getActorRole(req), 'scheduler create job');
    return this.scheduler.createJob(body);
  }

  @Patch('jobs/:id')
  updateJob(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'scheduler update job');
    return this.scheduler.updateJob(id, body);
  }

  @Post('jobs/:id/run-now')
  runNow(@Req() req: any, @Param('id') id: string) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'scheduler run-now');
    return this.scheduler.runNow(id);
  }

  @Get('runs')
  runs(@Req() req: any) {
    assertAdminToken(req);
    return this.scheduler.listRuns();
  }

  @Post('dry-run/e2e')
  runE2EDryRun(@Req() req: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'scheduler e2e dry-run');
    return this.scheduler.runEndToEndDryRun();
  }

  @Post('social-publish/run-now')
  runSocialPublish(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'scheduler social publish run-now');
    return this.scheduler.runScheduledSocialPublishing(Number(body?.limit) || 20);
  }

  @Post('seed-defaults')
  seedDefaults(@Req() req: any, @Body() body: any) {
    assertAdminToken(req);
    assertAdminRole(getActorRole(req), 'scheduler seed defaults');
    return this.scheduler.seedDefaultPipeline(body?.campaignId);
  }
}
