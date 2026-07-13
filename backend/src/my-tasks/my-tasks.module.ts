import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { MyTasksController } from './my-tasks.controller';
import { MyTasksService } from './my-tasks.service';

@Module({
  imports: [OrdersModule],
  controllers: [MyTasksController],
  providers: [MyTasksService],
})
export class MyTasksModule {}
