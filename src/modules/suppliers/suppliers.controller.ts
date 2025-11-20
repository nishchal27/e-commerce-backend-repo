/**
 * Suppliers Controller
 *
 * This controller handles HTTP requests for supplier-related endpoints.
 *
 * Endpoints:
 * - GET /suppliers - List all suppliers
 * - GET /suppliers/:id - Get supplier by ID
 * - GET /suppliers/code/:code - Get supplier by code
 * - POST /suppliers - Create supplier (admin only)
 * - PUT /suppliers/:id - Update supplier (admin only)
 * - DELETE /suppliers/:id - Delete supplier (admin only)
 * - GET /suppliers/costs/variant/:variantId - Get product cost for variant
 * - POST /suppliers/costs - Create/update product cost (admin only)
 * - DELETE /suppliers/costs/variant/:variantId - Delete product cost (admin only)
 * - GET /suppliers/margin/variant/:variantId - Calculate margin for variant
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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateProductCostDto } from './dto/create-product-cost.dto';
import { SupplierResponseDto, ProductCostResponseDto } from './dto/supplier-response.dto';

/**
 * SuppliersController handles HTTP requests for supplier endpoints
 */
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  /**
   * GET /suppliers
   * Get all suppliers.
   *
   * Query parameters:
   * - includeInactive: Include inactive suppliers (default: false)
   *
   * @returns Array of suppliers
   */
  @Get()
  async findAll(
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
  ): Promise<SupplierResponseDto[]> {
    return this.suppliersService.findAll(includeInactive);
  }

  /**
   * GET /suppliers/:id
   * Get a single supplier by ID.
   *
   * @param id - Supplier UUID
   * @returns Supplier
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<SupplierResponseDto> {
    return this.suppliersService.findOne(id);
  }

  /**
   * GET /suppliers/code/:code
   * Get a supplier by code.
   *
   * @param code - Supplier code
   * @returns Supplier
   */
  @Get('code/:code')
  async findByCode(@Param('code') code: string): Promise<SupplierResponseDto> {
    return this.suppliersService.findByCode(code);
  }

  /**
   * POST /suppliers
   * Create a new supplier.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param createSupplierDto - Supplier creation data
   * @returns Created supplier
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createSupplierDto: CreateSupplierDto): Promise<SupplierResponseDto> {
    return this.suppliersService.create(createSupplierDto);
  }

  /**
   * PUT /suppliers/:id
   * Update an existing supplier.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Supplier UUID
   * @param updateSupplierDto - Supplier update data
   * @returns Updated supplier
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  /**
   * DELETE /suppliers/:id
   * Delete a supplier (soft delete).
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Supplier UUID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.suppliersService.remove(id);
  }

  // ========== Product Cost Endpoints ==========

  /**
   * GET /suppliers/costs/variant/:variantId
   * Get product cost for a variant.
   *
   * @param variantId - Variant UUID
   * @returns Product cost or null
   */
  @Get('costs/variant/:variantId')
  async getProductCost(@Param('variantId') variantId: string): Promise<ProductCostResponseDto | null> {
    return this.suppliersService.getProductCost(variantId);
  }

  /**
   * POST /suppliers/costs
   * Create or update product cost (upsert).
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param createDto - Product cost data
   * @returns Created or updated product cost
   */
  @Post('costs')
  @HttpCode(HttpStatus.CREATED)
  async upsertProductCost(@Body() createDto: CreateProductCostDto): Promise<ProductCostResponseDto> {
    return this.suppliersService.upsertProductCost(createDto);
  }

  /**
   * DELETE /suppliers/costs/variant/:variantId
   * Delete product cost.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param variantId - Variant UUID
   */
  @Delete('costs/variant/:variantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProductCost(@Param('variantId') variantId: string): Promise<void> {
    return this.suppliersService.deleteProductCost(variantId);
  }

  /**
   * GET /suppliers/margin/variant/:variantId
   * Calculate margin for a variant.
   *
   * @param variantId - Variant UUID
   * @returns Margin information or null if cost not available
   */
  @Get('margin/variant/:variantId')
  async calculateMargin(@Param('variantId') variantId: string): Promise<{ margin: number; marginPercent: number } | null> {
    return this.suppliersService.calculateMargin(variantId);
  }
}

