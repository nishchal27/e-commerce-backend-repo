/**
 * Categories Controller
 *
 * This controller handles HTTP requests for category-related endpoints.
 *
 * Endpoints:
 * - GET /categories - List all categories
 * - GET /categories/tree - Get category tree (hierarchical)
 * - GET /categories/:id - Get category by ID
 * - GET /categories/slug/:slug - Get category by slug
 * - POST /categories - Create category (admin only)
 * - PUT /categories/:id - Update category (admin only)
 * - DELETE /categories/:id - Delete category (admin only)
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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';

/**
 * CategoriesController handles HTTP requests for category endpoints
 */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * GET /categories
   * Get all categories.
   *
   * Query parameters:
   * - includeInactive: Include inactive categories (default: false)
   * - includeChildren: Include child categories (default: false)
   * - parentId: Filter by parent ID (null for root categories)
   *
   * @returns Array of categories
   */
  @Get()
  async findAll(
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
    @Query('includeChildren', new DefaultValuePipe(false), ParseBoolPipe) includeChildren: boolean,
    @Query('parentId') parentId?: string | null,
  ): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findAll(includeInactive, includeChildren, parentId);
  }

  /**
   * GET /categories/tree
   * Get category tree (hierarchical structure).
   *
   * Query parameters:
   * - includeInactive: Include inactive categories (default: false)
   *
   * @returns Array of root categories with nested children
   */
  @Get('tree')
  async findTree(
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
  ): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findTree(includeInactive);
  }

  /**
   * GET /categories/:id
   * Get a single category by ID.
   *
   * Query parameters:
   * - includeChildren: Include child categories (default: false)
   *
   * @param id - Category UUID
   * @returns Category
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('includeChildren', new DefaultValuePipe(false), ParseBoolPipe) includeChildren: boolean,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.findOne(id, includeChildren);
  }

  /**
   * GET /categories/slug/:slug
   * Get a category by slug.
   *
   * Query parameters:
   * - includeChildren: Include child categories (default: false)
   *
   * @param slug - Category slug
   * @returns Category
   */
  @Get('slug/:slug')
  async findBySlug(
    @Param('slug') slug: string,
    @Query('includeChildren', new DefaultValuePipe(false), ParseBoolPipe) includeChildren: boolean,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.findBySlug(slug, includeChildren);
  }

  /**
   * POST /categories
   * Create a new category.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param createCategoryDto - Category creation data
   * @returns Created category
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createCategoryDto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.categoriesService.create(createCategoryDto);
  }

  /**
   * PUT /categories/:id
   * Update an existing category.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Category UUID
   * @param updateCategoryDto - Category update data
   * @returns Updated category
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  /**
   * DELETE /categories/:id
   * Delete a category (soft delete).
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Category UUID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.categoriesService.remove(id);
  }
}

