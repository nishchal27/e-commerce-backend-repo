/**
 * Suppliers Repository
 *
 * This repository abstracts database operations for suppliers and product costs.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateProductCostDto } from './dto/create-product-cost.dto';
import { Prisma } from '@prisma/client';

/**
 * SuppliersRepository handles all database operations for suppliers
 */
@Injectable()
export class SuppliersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all suppliers with optional filtering.
   * By default, filters out inactive suppliers.
   *
   * @param includeInactive - Whether to include inactive suppliers
   * @returns Array of suppliers
   */
  async findAll(includeInactive: boolean = false): Promise<Prisma.SupplierGetPayload<{}>[]> {
    const where: Prisma.SupplierWhereInput = includeInactive ? {} : { isActive: true };

    return this.prisma.supplier.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Find a supplier by ID.
   *
   * @param id - Supplier UUID
   * @returns Supplier or null if not found
   */
  async findById(id: string): Promise<Prisma.SupplierGetPayload<{}> | null> {
    return this.prisma.supplier.findUnique({
      where: { id },
    });
  }

  /**
   * Find a supplier by code.
   *
   * @param code - Supplier code
   * @returns Supplier or null if not found
   */
  async findByCode(code: string): Promise<Prisma.SupplierGetPayload<{}> | null> {
    return this.prisma.supplier.findUnique({
      where: { code },
    });
  }

  /**
   * Create a new supplier.
   *
   * @param data - Supplier creation data
   * @returns Created supplier
   */
  async create(data: CreateSupplierDto): Promise<Prisma.SupplierGetPayload<{}>> {
    return this.prisma.supplier.create({
      data,
    });
  }

  /**
   * Update an existing supplier.
   *
   * @param id - Supplier UUID
   * @param data - Supplier update data
   * @returns Updated supplier
   */
  async update(id: string, data: UpdateSupplierDto): Promise<Prisma.SupplierGetPayload<{}>> {
    return this.prisma.supplier.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a supplier (soft delete by setting isActive = false).
   *
   * @param id - Supplier UUID
   * @returns Updated supplier
   */
  async delete(id: string): Promise<Prisma.SupplierGetPayload<{}>> {
    return this.prisma.supplier.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Get count of products (variants) for a supplier.
   *
   * @param id - Supplier UUID
   * @returns Product count
   */
  async getProductCount(id: string): Promise<number> {
    return this.prisma.productCost.count({
      where: {
        supplierId: id,
      },
    });
  }

  // ========== Product Cost Operations ==========

  /**
   * Get product cost for a variant.
   *
   * @param variantId - Variant UUID
   * @returns Product cost or null if not found
   */
  async findProductCostByVariantId(variantId: string): Promise<Prisma.ProductCostGetPayload<{}> | null> {
    return this.prisma.productCost.findUnique({
      where: { variantId },
      include: {
        supplier: true,
      },
    });
  }

  /**
   * Create or update product cost (upsert).
   *
   * @param data - Product cost data
   * @returns Created or updated product cost
   */
  async upsertProductCost(data: CreateProductCostDto): Promise<Prisma.ProductCostGetPayload<{}>> {
    return this.prisma.productCost.upsert({
      where: { variantId: data.variantId },
      create: {
        variantId: data.variantId,
        supplierId: data.supplierId,
        costPrice: data.costPrice,
        currency: data.currency || 'USD',
        notes: data.notes,
      },
      update: {
        supplierId: data.supplierId,
        costPrice: data.costPrice,
        currency: data.currency || 'USD',
        notes: data.notes,
      },
      include: {
        supplier: true,
      },
    });
  }

  /**
   * Get product costs for multiple variants.
   *
   * @param variantIds - Array of variant UUIDs
   * @returns Map of variantId to product cost
   */
  async findProductCostsByVariantIds(
    variantIds: string[],
  ): Promise<Map<string, Prisma.ProductCostGetPayload<{ include: { supplier: true } }>>> {
    const costs = await this.prisma.productCost.findMany({
      where: {
        variantId: { in: variantIds },
      },
      include: {
        supplier: true,
      },
    });

    const map = new Map<string, Prisma.ProductCostGetPayload<{ include: { supplier: true } }>>();
    for (const cost of costs) {
      map.set(cost.variantId, cost);
    }

    return map;
  }

  /**
   * Delete product cost.
   *
   * @param variantId - Variant UUID
   * @returns Deleted product cost
   */
  async deleteProductCost(variantId: string): Promise<Prisma.ProductCostGetPayload<{}>> {
    return this.prisma.productCost.delete({
      where: { variantId },
    });
  }
}

