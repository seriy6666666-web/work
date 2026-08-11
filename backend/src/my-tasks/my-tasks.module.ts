import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { MaterialsModule } from '../materials/materials.module';
import { MyTasksController } from './my-tasks.controller';
import { MyTasksService } from './my-tasks.service';

@Module({
  imports: [OrdersModule, MaterialsModule],
  controllers: [MyTasksController],
  providers: [MyTasksService],
})
export class MyTasksModule {}
