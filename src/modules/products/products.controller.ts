/**
 * Products Controller
 *
 * This controller handles HTTP requests for product-related endpoints.
 * It validates request data, delegates to the service layer, and returns HTTP responses.
 *
 * Endpoints:
 * - GET /products - List all products (paginated)
 * - GET /products/:id - Get product by ID (cached)
 * - POST /products - Create product (admin only - TODO: add auth guard)
 * - PUT /products/:id - Update product (admin only - TODO: add auth guard)
 * - DELETE /products/:id - Delete product (admin only - TODO: add auth guard)
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
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { Req } from '@nestjs/common';
import { RequestWithId } from '../../common/middleware/request-id.middleware';

/**
 * ProductsController handles HTTP requests for product endpoints
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * POST /products
   * Create a new product.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param createProductDto - Product creation data
   * @returns Created product
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    return this.productsService.create(createProductDto);
  }

  /**
   * GET /products
   * Get paginated list of products.
   *
   * Query parameters:
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 20, max: 100)
   *
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated list of products
   */
  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Req() req: RequestWithId,
  ) {
    // Enforce maximum page size
    const maxLimit = 100;
    const actualLimit = Math.min(limit, maxLimit);

    return this.productsService.findAll(page, actualLimit);
  }

  /**
   * GET /products/:id
   * Get a single product by ID.
   * This endpoint uses read-through caching (LRU in-memory + Redis).
   * Subsequent requests for the same product ID will be faster due to caching.
   *
   * @param id - Product UUID
   * @returns Product with variants
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: RequestWithId,
  ): Promise<ProductResponseDto> {
    return this.productsService.findOne(id);
  }

  /**
   * PUT /products/:id
   * Update an existing product.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Product UUID
   * @param updateProductDto - Product update data
   * @returns Updated product
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(id, updateProductDto);
  }

  /**
   * DELETE /products/:id
   * Delete a product.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Product UUID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.productsService.remove(id);
  }
}

