/**
 * Media Controller
 *
 * This controller handles HTTP requests for media-related endpoints.
 *
 * Endpoints:
 * - GET /media/products/:productId - Get product media
 * - GET /media/products/:productId/primary - Get primary product image
 * - POST /media/products/:productId - Create product media (admin)
 * - PATCH /media/products/:id - Update product media (admin)
 * - DELETE /media/products/:id - Delete product media (admin)
 * - POST /media/products/:productId/reorder - Reorder product media (admin)
 * - GET /media/variants/:variantId - Get variant media
 * - POST /media/variants/:variantId - Create variant media (admin)
 * - PATCH /media/variants/:id - Update variant media (admin)
 * - DELETE /media/variants/:id - Delete variant media (admin)
 * - POST /media/variants/:variantId/reorder - Reorder variant media (admin)
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MediaService } from './media.service';
import { CreateProductMediaDto } from './dto/create-product-media.dto';
import { CreateVariantMediaDto } from './dto/create-variant-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import {
  ProductMediaResponseDto,
  VariantMediaResponseDto,
} from './dto/media-response.dto';

/**
 * MediaController handles HTTP requests for media endpoints
 */
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  // ========== Product Media Endpoints ==========

  /**
   * GET /media/products/:productId
   * Get all media for a product.
   *
   * @param productId - Product UUID
   * @returns Array of product media
   */
  @Get('products/:productId')
  async getProductMedia(@Param('productId') productId: string): Promise<ProductMediaResponseDto[]> {
    return this.mediaService.getProductMedia(productId);
  }

  /**
   * GET /media/products/:productId/primary
   * Get primary product image.
   *
   * @param productId - Product UUID
   * @returns Primary product media or null
   */
  @Get('products/:productId/primary')
  async getPrimaryProductImage(@Param('productId') productId: string): Promise<ProductMediaResponseDto | null> {
    return this.mediaService.getPrimaryProductImage(productId);
  }

  /**
   * POST /media/products/:productId
   * Create product media.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param productId - Product UUID
   * @param createDto - Media creation data
   * @returns Created product media
   */
  @Post('products/:productId')
  @HttpCode(HttpStatus.CREATED)
  async createProductMedia(
    @Param('productId') productId: string,
    @Body() createDto: CreateProductMediaDto,
  ): Promise<ProductMediaResponseDto> {
    return this.mediaService.createProductMedia(productId, createDto);
  }

  /**
   * PATCH /media/products/:id
   * Update product media.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Media UUID
   * @param updateDto - Media update data
   * @returns Updated product media
   */
  @Patch('products/:id')
  async updateProductMedia(
    @Param('id') id: string,
    @Body() updateDto: UpdateMediaDto,
  ): Promise<ProductMediaResponseDto> {
    return this.mediaService.updateProductMedia(id, updateDto);
  }

  /**
   * DELETE /media/products/:id
   * Delete product media.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Media UUID
   */
  @Delete('products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProductMedia(@Param('id') id: string): Promise<void> {
    return this.mediaService.deleteProductMedia(id);
  }

  /**
   * POST /media/products/:productId/reorder
   * Reorder product media.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param productId - Product UUID
   * @param updates - Array of {id, position} updates
   */
  @Post('products/:productId/reorder')
  @HttpCode(HttpStatus.OK)
  async reorderProductMedia(
    @Param('productId') productId: string,
    @Body() updates: { id: string; position: number }[],
  ): Promise<void> {
    return this.mediaService.reorderProductMedia(productId, updates);
  }

  // ========== Variant Media Endpoints ==========

  /**
   * GET /media/variants/:variantId
   * Get all media for a variant.
   *
   * @param variantId - Variant UUID
   * @returns Array of variant media
   */
  @Get('variants/:variantId')
  async getVariantMedia(@Param('variantId') variantId: string): Promise<VariantMediaResponseDto[]> {
    return this.mediaService.getVariantMedia(variantId);
  }

  /**
   * POST /media/variants/:variantId
   * Create variant media.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param variantId - Variant UUID
   * @param createDto - Media creation data
   * @returns Created variant media
   */
  @Post('variants/:variantId')
  @HttpCode(HttpStatus.CREATED)
  async createVariantMedia(
    @Param('variantId') variantId: string,
    @Body() createDto: CreateVariantMediaDto,
  ): Promise<VariantMediaResponseDto> {
    return this.mediaService.createVariantMedia(variantId, createDto);
  }

  /**
   * PATCH /media/variants/:id
   * Update variant media.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Media UUID
   * @param updateDto - Media update data
   * @returns Updated variant media
   */
  @Patch('variants/:id')
  async updateVariantMedia(
    @Param('id') id: string,
    @Body() updateDto: UpdateMediaDto,
  ): Promise<VariantMediaResponseDto> {
    return this.mediaService.updateVariantMedia(id, updateDto);
  }

  /**
   * DELETE /media/variants/:id
   * Delete variant media.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Media UUID
   */
  @Delete('variants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVariantMedia(@Param('id') id: string): Promise<void> {
    return this.mediaService.deleteVariantMedia(id);
  }

  /**
   * POST /media/variants/:variantId/reorder
   * Reorder variant media.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param variantId - Variant UUID
   * @param updates - Array of {id, position} updates
   */
  @Post('variants/:variantId/reorder')
  @HttpCode(HttpStatus.OK)
  async reorderVariantMedia(
    @Param('variantId') variantId: string,
    @Body() updates: { id: string; position: number }[],
  ): Promise<void> {
    return this.mediaService.reorderVariantMedia(variantId, updates);
  }
}

