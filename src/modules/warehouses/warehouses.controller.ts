/**
 * Warehouses Controller
 *
 * This controller handles HTTP requests for warehouse-related endpoints.
 *
 * Endpoints:
 * - GET /warehouses - List all warehouses
 * - GET /warehouses/:id - Get warehouse by ID
 * - GET /warehouses/code/:code - Get warehouse by code
 * - POST /warehouses - Create warehouse (admin only)
 * - PUT /warehouses/:id - Update warehouse (admin only)
 * - DELETE /warehouses/:id - Delete warehouse (admin only)
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseBoolPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseResponseDto } from './dto/warehouse-response.dto';

/**
 * WarehousesController handles HTTP requests for warehouse endpoints
 */
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  /**
   * GET /warehouses
   * Get all warehouses.
   *
   * Query parameters:
   * - includeInactive: Include inactive warehouses (default: false)
   *
   * @returns Array of warehouses
   */
  @Get()
  async findAll(
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
  ): Promise<WarehouseResponseDto[]> {
    return this.warehousesService.findAll(includeInactive);
  }

  /**
   * GET /warehouses/:id
   * Get a single warehouse by ID.
   *
   * @param id - Warehouse UUID
   * @returns Warehouse
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<WarehouseResponseDto> {
    return this.warehousesService.findOne(id);
  }

  /**
   * GET /warehouses/code/:code
   * Get a warehouse by code.
   *
   * @param code - Warehouse code
   * @returns Warehouse
   */
  @Get('code/:code')
  async findByCode(@Param('code') code: string): Promise<WarehouseResponseDto> {
    return this.warehousesService.findByCode(code);
  }

  /**
   * POST /warehouses
   * Create a new warehouse.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param createWarehouseDto - Warehouse creation data
   * @returns Created warehouse
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createWarehouseDto: CreateWarehouseDto): Promise<WarehouseResponseDto> {
    return this.warehousesService.create(createWarehouseDto);
  }

  /**
   * PUT /warehouses/:id
   * Update an existing warehouse.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Warehouse UUID
   * @param updateWarehouseDto - Warehouse update data
   * @returns Updated warehouse
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    return this.warehousesService.update(id, updateWarehouseDto);
  }

  /**
   * DELETE /warehouses/:id
   * Delete a warehouse (soft delete).
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Warehouse UUID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.warehousesService.remove(id);
  }
}

