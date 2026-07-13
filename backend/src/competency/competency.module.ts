import { Module } from '@nestjs/common';
import { TransfersModule } from '../transfers/transfers.module';
import { AbsencesModule } from '../absences/absences.module';
import { CompetencyController } from './competency.controller';
import { CompetencyService } from './competency.service';

@Module({
  imports: [TransfersModule, AbsencesModule],
  controllers: [CompetencyController],
  providers: [CompetencyService],
})
export class CompetencyModule {}
