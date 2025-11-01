/**
 * Products Repository
 *
 * This repository abstracts database operations for products.
 * It provides a clean interface between the service layer and Prisma,
 * making it easier to test and swap out database implementations.
 *
 * Responsibilities:
 * - CRUD operations for products and variants
 * - Database query optimization
 * - Type-safe database access via Prisma
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma } from '@prisma/client';

/**
 * Extended Product type that includes variants relation
 * Uses Prisma's generated type for type safety
 */
export type ProductWithVariants = Prisma.ProductGetPayload<{
  include: { variants: true };
}>;

/**
 * ProductsRepository handles all database operations for products
 */
@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all products with pagination and optional filtering.
   *
   * @param skip - Number of records to skip (for pagination)
   * @param take - Number of records to take (page size)
   * @param where - Optional Prisma where clause for filtering
   * @returns Array of products with variants
   */
  async findAll(
    skip: number = 0,
    take: number = 20,
    where?: any,
  ): Promise<ProductWithVariants[]> {
    return this.prisma.product.findMany({
      where,
      skip,
      take,
      include: {
        variants: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Find a product by ID with its variants.
   *
   * @param id - Product UUID
   * @returns Product with variants or null if not found
   */
  async findById(id: string): Promise<ProductWithVariants | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
      },
    });
  }

  /**
   * Find a product by slug with its variants.
   * Useful for SEO-friendly URLs.
   *
   * @param slug - Product slug (e.g., "wireless-headphones")
   * @returns Product with variants or null if not found
   */
  async findBySlug(slug: string): Promise<ProductWithVariants | null> {
    return this.prisma.product.findUnique({
      where: { slug },
      include: {
        variants: true,
      },
    });
  }

  /**
   * Create a new product with optional variants.
   * Uses Prisma transaction to ensure data consistency.
   *
   * @param data - Product data including optional variants
   * @returns Created product with variants
   */
  async create(data: CreateProductDto): Promise<ProductWithVariants> {
    const { variants, ...productData } = data;

    return this.prisma.product.create({
      data: {
        ...productData,
        variants: variants
          ? {
              create: variants,
            }
          : undefined,
      },
      include: {
        variants: true,
      },
    });
  }

  /**
   * Update an existing product.
   * Variants can be updated separately via variant-specific endpoints.
   * Note: This method excludes variants from updates as they require nested operations.
   *
   * @param id - Product UUID
   * @param data - Product update data (variants are excluded)
   * @returns Updated product with variants
   */
  async update(id: string, data: UpdateProductDto): Promise<ProductWithVariants> {
    // Extract variants if present (but we don't support updating variants via this method)
    // Variants should be updated via separate variant endpoints
    const { variants, ...productUpdateData } = data;

    return this.prisma.product.update({
      where: { id },
      data: productUpdateData,
      include: {
        variants: true,
      },
    });
  }

  /**
   * Delete a product and cascade delete its variants.
   *
   * @param id - Product UUID
   * @returns Deleted product
   */
  async delete(id: string): Promise<Prisma.ProductGetPayload<{}>> {
    return this.prisma.product.delete({
      where: { id },
    });
  }

  /**
   * Count total number of products (useful for pagination).
   *
   * @param where - Optional Prisma where clause for filtering
   * @returns Total count
   */
  async count(where?: any): Promise<number> {
    return this.prisma.product.count({ where });
  }
}

