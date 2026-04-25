import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TodayController } from './today.controller';
import { TodayService } from './today.service';

@Module({
  controllers: [TodayController],
  providers: [TodayService, PrismaService],
})
export class TodayModule {}
