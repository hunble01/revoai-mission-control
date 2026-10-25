import { Module } from '@nestjs/common';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { SocialPublishCronService } from './social-publish-cron.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [SchedulerController],
  providers: [SchedulerService, SocialPublishCronService, PrismaService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
