import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TrendsController } from './trends.controller';
import { TrendsService } from './trends.service';

@Module({
  controllers: [TrendsController],
  providers: [TrendsService, PrismaService],
  exports: [TrendsService],
})
export class TrendsModule {}
