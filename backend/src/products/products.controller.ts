import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductOperationDto } from './dto/create-product-operation.dto';
import { SetPlatformsDto } from './dto/set-platforms.dto';
import { ProductsService } from './products.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLANNER)
@Controller()
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get('products')
  list(@Query('includeArchived') includeArchived?: string) {
    return this.products.list(includeArchived === 'true');
  }

  @Post('products')
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch('products/:id/archive')
  archive(@Param('id') id: string, @Body('archived') archived: boolean) {
    return this.products.setArchived(id, archived);
  }

  @Patch('products/:id/platforms')
  setPlatforms(@Param('id') id: string, @Body() dto: SetPlatformsDto) {
    return this.products.setPlatforms(id, dto);
  }

  @Delete('products/:id')
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }

  @Post('products/:id/operations')
  addOperation(@Param('id') id: string, @Body() dto: CreateProductOperationDto) {
    return this.products.addOperation(id, dto);
  }

  @Delete('product-operations/:id')
  removeOperation(@Param('id') id: string) {
    return this.products.removeOperation(id);
  }
}
