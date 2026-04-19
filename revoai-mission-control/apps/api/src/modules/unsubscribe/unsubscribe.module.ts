import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UnsubscribeController } from './unsubscribe.controller';
import { UnsubscribeService } from './unsubscribe.service';

@Module({
  controllers: [UnsubscribeController],
  providers: [UnsubscribeService, PrismaService],
  exports: [UnsubscribeService],
})
export class UnsubscribeModule {}
