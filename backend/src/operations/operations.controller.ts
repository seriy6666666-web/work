import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { OperationsService } from './operations.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class OperationsController {
  constructor(private operationsService: OperationsService) {}

  @Get('orders/:orderId/operations')
  listByOrder(@Param('orderId') orderId: string) {
    return this.operationsService.listByOrder(orderId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.PLANNER)
  @Post('orders/:orderId/operations')
  create(@Param('orderId') orderId: string, @Body() dto: CreateOperationDto) {
    return this.operationsService.create(orderId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.PLANNER)
  @Patch('operations/:id')
  update(@Param('id') id: string, @Body() dto: UpdateOperationDto) {
    return this.operationsService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.PLANNER)
  @Delete('operations/:id')
  remove(@Param('id') id: string) {
    return this.operationsService.remove(id);
  }
}
