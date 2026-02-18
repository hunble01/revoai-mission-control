import { Module } from '@nestjs/common';
import { HealthController } from './modules/health/health.controller';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { SettingsModule } from './modules/settings/settings.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { LeadsModule } from './modules/leads/leads.module';
import { DraftsModule } from './modules/drafts/drafts.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AgentsModule } from './modules/agents/agents.module';
import { EventsModule } from './modules/events/events.module';
import { FeedModule } from './modules/feed/feed.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    EventsModule,
    ApprovalsModule,
    SettingsModule,
    CampaignsModule,
    SchedulerModule,
    LeadsModule,
    DraftsModule,
    TasksModule,
    AgentsModule,
    FeedModule,
    AuditModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
