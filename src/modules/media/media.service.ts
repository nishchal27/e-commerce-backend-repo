/**
 * Media Service
 *
 * This service contains the business logic for media operations.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MediaRepository } from './media.repository';
import { CreateProductMediaDto } from './dto/create-product-media.dto';
import { CreateVariantMediaDto } from './dto/create-variant-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import {
  ProductMediaResponseDto,
  VariantMediaResponseDto,
} from './dto/media-response.dto';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { Logger } from '../../lib/logger';

/**
 * MediaService handles business logic for media operations
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  /**
   * Get all product media for a product.
   *
   * @param productId - Product UUID
   * @returns Array of product media
   */
  async getProductMedia(productId: string): Promise<ProductMediaResponseDto[]> {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    return this.mediaRepository.findProductMedia(productId);
  }

  /**
   * Get all variant media for a variant.
   *
   * @param variantId - Variant UUID
   * @returns Array of variant media
   */
  async getVariantMedia(variantId: string): Promise<VariantMediaResponseDto[]> {
    // Verify variant exists
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant with ID ${variantId} not found`);
    }

    return this.mediaRepository.findVariantMedia(variantId);
  }

  /**
   * Get primary product image.
   *
   * @param productId - Product UUID
   * @returns Primary product media or null
   */
  async getPrimaryProductImage(productId: string): Promise<ProductMediaResponseDto | null> {
    return this.mediaRepository.findPrimaryProductImage(productId);
  }

  /**
   * Create product media.
   *
   * @param productId - Product UUID
   * @param createDto - Media creation data
   * @returns Created product media
   * @throws NotFoundException if product not found
   */
  async createProductMedia(
    productId: string,
    createDto: CreateProductMediaDto,
  ): Promise<ProductMediaResponseDto> {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const media = await this.mediaRepository.createProductMedia(productId, createDto);
    this.logger.log(`Product media created: ${media.id} for product ${productId}`, 'MediaService');

    return media;
  }

  /**
   * Create variant media.
   *
   * @param variantId - Variant UUID
   * @param createDto - Media creation data
   * @returns Created variant media
   * @throws NotFoundException if variant not found
   */
  async createVariantMedia(
    variantId: string,
    createDto: CreateVariantMediaDto,
  ): Promise<VariantMediaResponseDto> {
    // Verify variant exists
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant with ID ${variantId} not found`);
    }

    const media = await this.mediaRepository.createVariantMedia(variantId, createDto);
    this.logger.log(`Variant media created: ${media.id} for variant ${variantId}`, 'MediaService');

    return media;
  }

  /**
   * Update product media.
   *
   * @param id - Media UUID
   * @param updateDto - Media update data
   * @returns Updated product media
   * @throws NotFoundException if media not found
   */
  async updateProductMedia(
    id: string,
    updateDto: UpdateMediaDto,
  ): Promise<ProductMediaResponseDto> {
    const existing = await this.mediaRepository.findProductMediaById(id);
    if (!existing) {
      throw new NotFoundException(`Product media with ID ${id} not found`);
    }

    const media = await this.mediaRepository.updateProductMedia(id, updateDto);
    this.logger.log(`Product media updated: ${id}`, 'MediaService');

    return media;
  }

  /**
   * Update variant media.
   *
   * @param id - Media UUID
   * @param updateDto - Media update data
   * @returns Updated variant media
   * @throws NotFoundException if media not found
   */
  async updateVariantMedia(
    id: string,
    updateDto: UpdateMediaDto,
  ): Promise<VariantMediaResponseDto> {
    const existing = await this.mediaRepository.findVariantMediaById(id);
    if (!existing) {
      throw new NotFoundException(`Variant media with ID ${id} not found`);
    }

    const media = await this.mediaRepository.updateVariantMedia(id, updateDto);
    this.logger.log(`Variant media updated: ${id}`, 'MediaService');

    return media;
  }

  /**
   * Delete product media.
   *
   * @param id - Media UUID
   * @throws NotFoundException if media not found
   */
  async deleteProductMedia(id: string): Promise<void> {
    const existing = await this.mediaRepository.findProductMediaById(id);
    if (!existing) {
      throw new NotFoundException(`Product media with ID ${id} not found`);
    }

    await this.mediaRepository.deleteProductMedia(id);
    this.logger.log(`Product media deleted: ${id}`, 'MediaService');
  }

  /**
   * Delete variant media.
   *
   * @param id - Media UUID
   * @throws NotFoundException if media not found
   */
  async deleteVariantMedia(id: string): Promise<void> {
    const existing = await this.mediaRepository.findVariantMediaById(id);
    if (!existing) {
      throw new NotFoundException(`Variant media with ID ${id} not found`);
    }

    await this.mediaRepository.deleteVariantMedia(id);
    this.logger.log(`Variant media deleted: ${id}`, 'MediaService');
  }

  /**
   * Reorder product media.
   * Updates positions of multiple media items.
   *
   * @param productId - Product UUID
   * @param updates - Array of {id, position} updates
   * @throws BadRequestException if media doesn't belong to product
   */
  async reorderProductMedia(
    productId: string,
    updates: { id: string; position: number }[],
  ): Promise<void> {
    // Verify all media belong to the product
    const mediaIds = updates.map((u) => u.id);
    const media = await this.prisma.productMedia.findMany({
      where: {
        id: { in: mediaIds },
        productId,
      },
    });

    if (media.length !== mediaIds.length) {
      throw new BadRequestException('One or more media items do not belong to this product');
    }

    await this.mediaRepository.reorderProductMedia(updates);
    this.logger.log(`Product media reordered for product ${productId}`, 'MediaService');
  }

  /**
   * Reorder variant media.
   * Updates positions of multiple media items.
   *
   * @param variantId - Variant UUID
   * @param updates - Array of {id, position} updates
   * @throws BadRequestException if media doesn't belong to variant
   */
  async reorderVariantMedia(
    variantId: string,
    updates: { id: string; position: number }[],
  ): Promise<void> {
    // Verify all media belong to the variant
    const mediaIds = updates.map((u) => u.id);
    const media = await this.prisma.variantMedia.findMany({
      where: {
        id: { in: mediaIds },
        variantId,
      },
    });

    if (media.length !== mediaIds.length) {
      throw new BadRequestException('One or more media items do not belong to this variant');
    }

    await this.mediaRepository.reorderVariantMedia(updates);
    this.logger.log(`Variant media reordered for variant ${variantId}`, 'MediaService');
  }
}

