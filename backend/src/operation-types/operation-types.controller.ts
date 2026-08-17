import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import { CreateOperationTypeDto } from './dto/create-operation-type.dto';
import { UpdateOperationTypeDto } from './dto/update-operation-type.dto';
import { OperationTypesService } from './operation-types.service';

@UseGuards(JwtAuthGuard)
@Controller('operation-types')
export class OperationTypesController {
  constructor(private operationTypes: OperationTypesService) {}

  // Читать может любой вошедший: начальник участка видит операции на доске.
  @Get()
  list(@Query('withArchived') withArchived?: string) {
    return this.operationTypes.list(withArchived === 'true');
  }

  @UseGuards(RolesGuard)
  @Roles(Role.PLANNER)
  @Post()
  create(@Body() dto: CreateOperationTypeDto) {
    return this.operationTypes.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.PLANNER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOperationTypeDto) {
    return this.operationTypes.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.PLANNER)
  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.operationTypes.archive(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.PLANNER)
  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.operationTypes.restore(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.PLANNER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.operationTypes.remove(id);
  }
}
