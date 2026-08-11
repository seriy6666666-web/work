import { Module } from '@nestjs/common';
import { ShiftsOrgController } from './shifts-org.controller';
import { ShiftsOrgService } from './shifts-org.service';

@Module({
  controllers: [ShiftsOrgController],
  providers: [ShiftsOrgService],
})
export class ShiftsOrgModule {}
