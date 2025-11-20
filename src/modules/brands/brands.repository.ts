/**
 * Brands Repository
 *
 * This repository abstracts database operations for brands.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { Prisma } from '@prisma/client';

/**
 * BrandsRepository handles all database operations for brands
 */
@Injectable()
export class BrandsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all brands with optional filtering.
   * By default, filters out inactive brands.
   *
   * @param includeInactive - Whether to include inactive brands
   * @returns Array of brands
   */
  async findAll(includeInactive: boolean = false): Promise<Prisma.BrandGetPayload<{}>[]> {
    const where: Prisma.BrandWhereInput = includeInactive ? {} : { isActive: true };

    return this.prisma.brand.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Find a brand by ID.
   *
   * @param id - Brand UUID
   * @returns Brand or null if not found
   */
  async findById(id: string): Promise<Prisma.BrandGetPayload<{}> | null> {
    return this.prisma.brand.findUnique({
      where: { id },
    });
  }

  /**
   * Find a brand by slug.
   *
   * @param slug - Brand slug
   * @returns Brand or null if not found
   */
  async findBySlug(slug: string): Promise<Prisma.BrandGetPayload<{}> | null> {
    return this.prisma.brand.findUnique({
      where: { slug },
    });
  }

  /**
   * Create a new brand.
   *
   * @param data - Brand creation data
   * @returns Created brand
   */
  async create(data: CreateBrandDto): Promise<Prisma.BrandGetPayload<{}>> {
    return this.prisma.brand.create({
      data,
    });
  }

  /**
   * Update an existing brand.
   *
   * @param id - Brand UUID
   * @param data - Brand update data
   * @returns Updated brand
   */
  async update(id: string, data: UpdateBrandDto): Promise<Prisma.BrandGetPayload<{}>> {
    return this.prisma.brand.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a brand (soft delete by setting isActive = false).
   *
   * @param id - Brand UUID
   * @returns Updated brand
   */
  async delete(id: string): Promise<Prisma.BrandGetPayload<{}>> {
    return this.prisma.brand.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Get count of products for a brand.
   *
   * @param id - Brand UUID
   * @returns Product count
   */
  async getProductCount(id: string): Promise<number> {
    return this.prisma.product.count({
      where: {
        brandId: id,
        isActive: true,
        deletedAt: null,
      },
    });
  }
}

