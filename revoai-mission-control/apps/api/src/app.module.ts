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
import { SeedModule } from './modules/seed/seed.module';
import { AuthModule } from './modules/auth/auth.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { ConnectionsModule } from './modules/connections/connections.module';
import { ResearchModule } from './modules/research/research.module';
import { SearchModule } from './modules/search/search.module';
import { SocialPostsModule } from './modules/social-posts/social-posts.module';
import { LinkedinModule } from './modules/linkedin/linkedin.module';
import { LinkedinDmModule } from './modules/linkedin-dm/linkedin-dm.module';
import { FacebookModule } from './modules/facebook/facebook.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ContentModule } from './modules/content/content.module';

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
    SeedModule,
    AuthModule,
    AlertsModule,
    ConnectionsModule,
    ResearchModule,
    SearchModule,
    SocialPostsModule,
    LinkedinModule,
    LinkedinDmModule,
    FacebookModule,
    AnalyticsModule,
    ContentModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
