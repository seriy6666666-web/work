import { Module } from '@nestjs/common';
import { TransfersModule } from '../transfers/transfers.module';
import { AbsencesModule } from '../absences/absences.module';
import { StatsModule } from '../stats/stats.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { OrdersModule } from '../orders/orders.module';
import { DistributionController } from './distribution.controller';
import { DistributionService } from './distribution.service';

@Module({
  imports: [TransfersModule, AbsencesModule, StatsModule, AttendanceModule, OrdersModule],
  controllers: [DistributionController],
  providers: [DistributionService],
})
export class DistributionModule {}
