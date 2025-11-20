/**
 * Collections Controller
 *
 * This controller handles HTTP requests for collection-related endpoints.
 *
 * Endpoints:
 * - GET /collections - List all collections
 * - GET /collections/:id - Get collection by ID
 * - GET /collections/slug/:slug - Get collection by slug
 * - POST /collections - Create collection (admin only)
 * - PUT /collections/:id - Update collection (admin only)
 * - DELETE /collections/:id - Delete collection (admin only)
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
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { CollectionResponseDto } from './dto/collection-response.dto';

/**
 * CollectionsController handles HTTP requests for collection endpoints
 */
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  /**
   * GET /collections
   * Get all collections.
   *
   * Query parameters:
   * - includeInactive: Include inactive collections (default: false)
   * - activeOnly: Only return currently active collections (within date range) (default: false)
   *
   * @returns Array of collections
   */
  @Get()
  async findAll(
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
    @Query('activeOnly', new DefaultValuePipe(false), ParseBoolPipe) activeOnly: boolean,
  ): Promise<CollectionResponseDto[]> {
    return this.collectionsService.findAll(includeInactive, activeOnly);
  }

  /**
   * GET /collections/:id
   * Get a single collection by ID.
   *
   * @param id - Collection UUID
   * @returns Collection
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<CollectionResponseDto> {
    return this.collectionsService.findOne(id);
  }

  /**
   * GET /collections/slug/:slug
   * Get a collection by slug.
   *
   * @param slug - Collection slug
   * @returns Collection
   */
  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string): Promise<CollectionResponseDto> {
    return this.collectionsService.findBySlug(slug);
  }

  /**
   * POST /collections
   * Create a new collection.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param createCollectionDto - Collection creation data
   * @returns Created collection
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createCollectionDto: CreateCollectionDto): Promise<CollectionResponseDto> {
    return this.collectionsService.create(createCollectionDto);
  }

  /**
   * PUT /collections/:id
   * Update an existing collection.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Collection UUID
   * @param updateCollectionDto - Collection update data
   * @returns Updated collection
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCollectionDto: UpdateCollectionDto,
  ): Promise<CollectionResponseDto> {
    return this.collectionsService.update(id, updateCollectionDto);
  }

  /**
   * DELETE /collections/:id
   * Delete a collection (soft delete).
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Collection UUID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.collectionsService.remove(id);
  }
}

