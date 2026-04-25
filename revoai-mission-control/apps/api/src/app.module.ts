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
import { InstagramModule } from './modules/instagram/instagram.module';
import { MetaDmModule } from './modules/meta-dm/meta-dm.module';
import { SocialReplyModule } from './modules/social-reply/social-reply.module';
import { YoutubeModule } from './modules/youtube/youtube.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ContentModule } from './modules/content/content.module';
import { UnsubscribeModule } from './modules/unsubscribe/unsubscribe.module';
import { DeliveryTrackerModule } from './modules/delivery-tracker/delivery-tracker.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  providers: [PrismaService],
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
    InstagramModule,
    MetaDmModule,
    SocialReplyModule,
    YoutubeModule,
    AnalyticsModule,
    ContentModule,
    UnsubscribeModule,
    DeliveryTrackerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
