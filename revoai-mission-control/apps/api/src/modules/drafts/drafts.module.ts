import { Module } from '@nestjs/common';
import { DraftsController } from './drafts.controller';
import { DraftsService } from './drafts.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [DraftsController],
  providers: [DraftsService, PrismaService],
})
export class DraftsModule {}
