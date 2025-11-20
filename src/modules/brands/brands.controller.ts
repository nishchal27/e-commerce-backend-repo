/**
 * Brands Controller
 *
 * This controller handles HTTP requests for brand-related endpoints.
 *
 * Endpoints:
 * - GET /brands - List all brands
 * - GET /brands/:id - Get brand by ID
 * - GET /brands/slug/:slug - Get brand by slug
 * - POST /brands - Create brand (admin only)
 * - PUT /brands/:id - Update brand (admin only)
 * - DELETE /brands/:id - Delete brand (admin only)
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
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { BrandResponseDto } from './dto/brand-response.dto';

/**
 * BrandsController handles HTTP requests for brand endpoints
 */
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  /**
   * GET /brands
   * Get all brands.
   *
   * Query parameters:
   * - includeInactive: Include inactive brands (default: false)
   *
   * @returns Array of brands
   */
  @Get()
  async findAll(
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
  ): Promise<BrandResponseDto[]> {
    return this.brandsService.findAll(includeInactive);
  }

  /**
   * GET /brands/:id
   * Get a single brand by ID.
   *
   * @param id - Brand UUID
   * @returns Brand
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<BrandResponseDto> {
    return this.brandsService.findOne(id);
  }

  /**
   * GET /brands/slug/:slug
   * Get a brand by slug.
   *
   * @param slug - Brand slug
   * @returns Brand
   */
  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string): Promise<BrandResponseDto> {
    return this.brandsService.findBySlug(slug);
  }

  /**
   * POST /brands
   * Create a new brand.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param createBrandDto - Brand creation data
   * @returns Created brand
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createBrandDto: CreateBrandDto): Promise<BrandResponseDto> {
    return this.brandsService.create(createBrandDto);
  }

  /**
   * PUT /brands/:id
   * Update an existing brand.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Brand UUID
   * @param updateBrandDto - Brand update data
   * @returns Updated brand
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateBrandDto: UpdateBrandDto,
  ): Promise<BrandResponseDto> {
    return this.brandsService.update(id, updateBrandDto);
  }

  /**
   * DELETE /brands/:id
   * Delete a brand (soft delete).
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Brand UUID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.brandsService.remove(id);
  }
}

