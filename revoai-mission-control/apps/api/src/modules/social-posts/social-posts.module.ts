import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { SocialPostsController } from './social-posts.controller';
import { SocialPostsService } from './social-posts.service';
import { ImagesModule } from '../images/images.module';

@Module({
  imports: [ImagesModule],
  controllers: [SocialPostsController],
  providers: [SocialPostsService, PrismaService, EventsService],
  exports: [SocialPostsService],
})
export class SocialPostsModule {}
