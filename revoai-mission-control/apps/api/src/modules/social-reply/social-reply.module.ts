import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SocialReplyController } from './social-reply.controller';
import { SocialReplyService } from './social-reply.service';

@Module({
  controllers: [SocialReplyController],
  providers: [SocialReplyService, PrismaService],
  exports: [SocialReplyService],
})
export class SocialReplyModule {}
