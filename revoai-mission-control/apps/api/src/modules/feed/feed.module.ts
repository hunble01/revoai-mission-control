import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [FeedController],
  providers: [PrismaService],
})
export class FeedModule {}
