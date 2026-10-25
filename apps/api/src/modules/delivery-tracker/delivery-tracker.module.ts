import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UnsubscribeModule } from '../unsubscribe/unsubscribe.module';
import { LeadsModule } from '../leads/leads.module';
import { DeliveryTrackerController } from './delivery-tracker.controller';
import { DeliveryTrackerService } from './delivery-tracker.service';

@Module({
  imports: [UnsubscribeModule, LeadsModule],
  controllers: [DeliveryTrackerController],
  providers: [DeliveryTrackerService, PrismaService],
})
export class DeliveryTrackerModule {}
