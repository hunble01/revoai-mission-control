import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { YoutubeController } from './youtube.controller';
import { YoutubeService } from './youtube.service';

@Module({
  controllers: [YoutubeController],
  providers: [YoutubeService, PrismaService],
  exports: [YoutubeService],
})
export class YoutubeModule {}
