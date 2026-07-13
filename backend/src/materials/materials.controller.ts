import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { AdjustMaterialDto } from './dto/adjust-material.dto';
import { MaterialsService } from './materials.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('materials')
export class MaterialsController {
  constructor(private materials: MaterialsService) {}

  @Roles(Role.PLANNER, Role.PRODUCTION_HEAD)
  @Get()
  list() {
    return this.materials.list();
  }

  @Roles(Role.PLANNER)
  @Post()
  create(@Body() dto: CreateMaterialDto) {
    return this.materials.create(dto);
  }

  @Roles(Role.PLANNER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMaterialDto) {
    return this.materials.update(id, dto);
  }

  @Roles(Role.PLANNER)
  @Post(':id/adjust')
  adjust(@Param('id') id: string, @Body() dto: AdjustMaterialDto) {
    return this.materials.adjust(id, dto);
  }

  @Roles(Role.PLANNER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.materials.remove(id);
  }
}
