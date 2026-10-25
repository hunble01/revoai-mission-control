import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { SocialAutopilotController } from './social-autopilot.controller';
import { SocialAutopilotService } from './social-autopilot.service';
import { SocialAutopilotCronService } from './social-autopilot-cron.service';
import { ContentModule } from '../content/content.module';
import { SocialPostsModule } from '../social-posts/social-posts.module';
import { ImagesModule } from '../images/images.module';
import { TrendsModule } from '../trends/trends.module';

@Module({
  imports: [ContentModule, SocialPostsModule, ImagesModule, TrendsModule],
  controllers: [SocialAutopilotController],
  providers: [SocialAutopilotService, SocialAutopilotCronService, PrismaService, EventsService],
  exports: [SocialAutopilotService],
})
export class SocialAutopilotModule {}
