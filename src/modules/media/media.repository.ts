/**
 * Media Repository
 *
 * This repository abstracts database operations for product and variant media.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { CreateProductMediaDto } from './dto/create-product-media.dto';
import { CreateVariantMediaDto } from './dto/create-variant-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { Prisma } from '@prisma/client';

/**
 * MediaRepository handles all database operations for media
 */
@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all product media for a product.
   *
   * @param productId - Product UUID
   * @returns Array of product media
   */
  async findProductMedia(productId: string): Promise<Prisma.ProductMediaGetPayload<{}>[]> {
    return this.prisma.productMedia.findMany({
      where: { productId },
      orderBy: [
        { isPrimary: 'desc' }, // Primary image first
        { position: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  /**
   * Find all variant media for a variant.
   *
   * @param variantId - Variant UUID
   * @returns Array of variant media
   */
  async findVariantMedia(variantId: string): Promise<Prisma.VariantMediaGetPayload<{}>[]> {
    return this.prisma.variantMedia.findMany({
      where: { variantId },
      orderBy: [
        { position: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  /**
   * Find product media by ID.
   *
   * @param id - Media UUID
   * @returns Product media or null if not found
   */
  async findProductMediaById(id: string): Promise<Prisma.ProductMediaGetPayload<{}> | null> {
    return this.prisma.productMedia.findUnique({
      where: { id },
    });
  }

  /**
   * Find variant media by ID.
   *
   * @param id - Media UUID
   * @returns Variant media or null if not found
   */
  async findVariantMediaById(id: string): Promise<Prisma.VariantMediaGetPayload<{}> | null> {
    return this.prisma.variantMedia.findUnique({
      where: { id },
    });
  }

  /**
   * Get primary product image.
   *
   * @param productId - Product UUID
   * @returns Primary product media or null if not found
   */
  async findPrimaryProductImage(productId: string): Promise<Prisma.ProductMediaGetPayload<{}> | null> {
    return this.prisma.productMedia.findFirst({
      where: {
        productId,
        isPrimary: true,
      },
    });
  }

  /**
   * Create product media.
   *
   * @param productId - Product UUID
   * @param data - Media creation data
   * @returns Created product media
   */
  async createProductMedia(
    productId: string,
    data: CreateProductMediaDto,
  ): Promise<Prisma.ProductMediaGetPayload<{}>> {
    // If setting as primary, unset other primary images
    if (data.isPrimary) {
      await this.prisma.productMedia.updateMany({
        where: { productId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return this.prisma.productMedia.create({
      data: {
        productId,
        ...data,
      },
    });
  }

  /**
   * Create variant media.
   *
   * @param variantId - Variant UUID
   * @param data - Media creation data
   * @returns Created variant media
   */
  async createVariantMedia(
    variantId: string,
    data: CreateVariantMediaDto,
  ): Promise<Prisma.VariantMediaGetPayload<{}>> {
    return this.prisma.variantMedia.create({
      data: {
        variantId,
        ...data,
      },
    });
  }

  /**
   * Update product media.
   *
   * @param id - Media UUID
   * @param data - Media update data
   * @returns Updated product media
   */
  async updateProductMedia(
    id: string,
    data: UpdateMediaDto,
  ): Promise<Prisma.ProductMediaGetPayload<{}>> {
    // If setting as primary, unset other primary images
    if (data.isPrimary) {
      const media = await this.prisma.productMedia.findUnique({
        where: { id },
        select: { productId: true },
      });

      if (media) {
        await this.prisma.productMedia.updateMany({
          where: {
            productId: media.productId,
            isPrimary: true,
            id: { not: id },
          },
          data: { isPrimary: false },
        });
      }
    }

    return this.prisma.productMedia.update({
      where: { id },
      data,
    });
  }

  /**
   * Update variant media.
   *
   * @param id - Media UUID
   * @param data - Media update data
   * @returns Updated variant media
   */
  async updateVariantMedia(
    id: string,
    data: UpdateMediaDto,
  ): Promise<Prisma.VariantMediaGetPayload<{}>> {
    // Remove isPrimary from data (not applicable to variant media)
    const { isPrimary, ...variantData } = data;

    return this.prisma.variantMedia.update({
      where: { id },
      data: variantData,
    });
  }

  /**
   * Delete product media.
   *
   * @param id - Media UUID
   * @returns Deleted product media
   */
  async deleteProductMedia(id: string): Promise<Prisma.ProductMediaGetPayload<{}>> {
    return this.prisma.productMedia.delete({
      where: { id },
    });
  }

  /**
   * Delete variant media.
   *
   * @param id - Media UUID
   * @returns Deleted variant media
   */
  async deleteVariantMedia(id: string): Promise<Prisma.VariantMediaGetPayload<{}>> {
    return this.prisma.variantMedia.delete({
      where: { id },
    });
  }

  /**
   * Reorder product media.
   * Updates positions of multiple media items.
   *
   * @param updates - Array of {id, position} updates
   * @returns Updated media items
   */
  async reorderProductMedia(updates: { id: string; position: number }[]): Promise<void> {
    await Promise.all(
      updates.map((update) =>
        this.prisma.productMedia.update({
          where: { id: update.id },
          data: { position: update.position },
        }),
      ),
    );
  }

  /**
   * Reorder variant media.
   * Updates positions of multiple media items.
   *
   * @param updates - Array of {id, position} updates
   * @returns Updated media items
   */
  async reorderVariantMedia(updates: { id: string; position: number }[]): Promise<void> {
    await Promise.all(
      updates.map((update) =>
        this.prisma.variantMedia.update({
          where: { id: update.id },
          data: { position: update.position },
        }),
      ),
    );
  }
}

