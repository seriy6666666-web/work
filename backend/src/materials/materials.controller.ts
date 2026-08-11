import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpsertStockDto } from './dto/upsert-stock.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { MaterialsService } from './materials.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class MaterialsController {
  constructor(private materials: MaterialsService) {}

  // --- Каталог ---
  @Roles(Role.PLANNER, Role.PRODUCTION_HEAD)
  @Get('materials')
  listCatalog() {
    return this.materials.listCatalog();
  }

  @Roles(Role.PLANNER)
  @Post('materials')
  createMaterial(@Body() dto: CreateMaterialDto) {
    return this.materials.createMaterial(dto);
  }

  @Roles(Role.PLANNER)
  @Patch('materials/:id')
  updateMaterial(@Param('id') id: string, @Body() dto: UpdateMaterialDto) {
    return this.materials.updateMaterial(id, dto);
  }

  @Roles(Role.PLANNER)
  @Delete('materials/:id')
  removeMaterial(@Param('id') id: string) {
    return this.materials.removeMaterial(id);
  }

  // --- Остатки в разрезе (площадка × проект) ---
  @Roles(Role.PLANNER, Role.PRODUCTION_HEAD)
  @Get('material-stocks')
  listStocks() {
    return this.materials.listStocks();
  }

  @Roles(Role.PLANNER)
  @Post('material-stocks')
  upsertStock(@Body() dto: UpsertStockDto) {
    return this.materials.upsertStock(dto);
  }

  @Roles(Role.PLANNER)
  @Post('material-stocks/:id/adjust')
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.materials.adjustStock(id, dto);
  }

  @Roles(Role.PLANNER)
  @Delete('material-stocks/:id')
  removeStock(@Param('id') id: string) {
    return this.materials.removeStock(id);
  }
}
