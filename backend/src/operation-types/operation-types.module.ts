import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OperationTypesController } from './operation-types.controller';
import { OperationTypesService } from './operation-types.service';

@Module({
  imports: [PrismaModule],
  controllers: [OperationTypesController],
  providers: [OperationTypesService],
  exports: [OperationTypesService],
})
export class OperationTypesModule {}
