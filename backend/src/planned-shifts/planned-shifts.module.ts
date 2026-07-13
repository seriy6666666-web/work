import { Module } from '@nestjs/common';
import { PlannedShiftsController } from './planned-shifts.controller';
import { PlannedShiftsService } from './planned-shifts.service';

@Module({
  controllers: [PlannedShiftsController],
  providers: [PlannedShiftsService],
})
export class PlannedShiftsModule {}
