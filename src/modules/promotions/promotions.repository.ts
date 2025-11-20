/**
 * Promotions Repository
 *
 * This repository abstracts database operations for promotions.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { Prisma } from '@prisma/client';

/**
 * PromotionsRepository handles all database operations for promotions
 */
@Injectable()
export class PromotionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all promotions with optional filtering.
   * By default, filters out inactive promotions.
   *
   * @param includeInactive - Whether to include inactive promotions
   * @param activeOnly - Whether to only return currently active promotions (within date range)
   * @returns Array of promotions
   */
  async findAll(includeInactive: boolean = false, activeOnly: boolean = false): Promise<Prisma.PromotionGetPayload<{}>[]> {
    const now = new Date();
    const where: Prisma.PromotionWhereInput = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(activeOnly ? {
        startDate: { lte: now },
        endDate: { gte: now },
      } : {}),
    };

    return this.prisma.promotion.findMany({
      where,
      orderBy: [
        { startDate: 'desc' },
        { code: 'asc' },
      ],
    });
  }

  /**
   * Find a promotion by ID.
   *
   * @param id - Promotion UUID
   * @returns Promotion or null if not found
   */
  async findById(id: string): Promise<Prisma.PromotionGetPayload<{}> | null> {
    return this.prisma.promotion.findUnique({
      where: { id },
    });
  }

  /**
   * Find a promotion by code.
   *
   * @param code - Promotion code
   * @returns Promotion or null if not found
   */
  async findByCode(code: string): Promise<Prisma.PromotionGetPayload<{}> | null> {
    return this.prisma.promotion.findUnique({
      where: { code: code.toUpperCase() }, // Normalize to uppercase
    });
  }

  /**
   * Create a new promotion.
   *
   * @param data - Promotion creation data
   * @returns Created promotion
   */
  async create(data: CreatePromotionDto): Promise<Prisma.PromotionGetPayload<{}>> {
    return this.prisma.promotion.create({
      data: {
        ...data,
        code: data.code.toUpperCase(), // Normalize to uppercase
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        applicableCategories: data.applicableCategories || Prisma.JsonNull,
        applicableBrands: data.applicableBrands || Prisma.JsonNull,
      },
    });
  }

  /**
   * Update an existing promotion.
   *
   * @param id - Promotion UUID
   * @param data - Promotion update data
   * @returns Updated promotion
   */
  async update(id: string, data: UpdatePromotionDto): Promise<Prisma.PromotionGetPayload<{}>> {
    const updateData: any = { ...data };
    
    if (data.code) {
      updateData.code = data.code.toUpperCase(); // Normalize to uppercase
    }
    if (data.startDate) {
      updateData.startDate = new Date(data.startDate);
    }
    if (data.endDate) {
      updateData.endDate = new Date(data.endDate);
    }
    if (data.applicableCategories !== undefined) {
      updateData.applicableCategories = data.applicableCategories || Prisma.JsonNull;
    }
    if (data.applicableBrands !== undefined) {
      updateData.applicableBrands = data.applicableBrands || Prisma.JsonNull;
    }

    return this.prisma.promotion.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a promotion (soft delete by setting isActive = false).
   *
   * @param id - Promotion UUID
   * @returns Updated promotion
   */
  async delete(id: string): Promise<Prisma.PromotionGetPayload<{}>> {
    return this.prisma.promotion.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Increment usage count for a promotion.
   *
   * @param id - Promotion UUID
   * @returns Updated promotion
   */
  async incrementUsage(id: string): Promise<Prisma.PromotionGetPayload<{}>> {
    return this.prisma.promotion.update({
      where: { id },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Check if a promotion is currently valid (within date range and usage limits).
   *
   * @param promotion - Promotion object
   * @returns True if promotion is valid
   */
  isPromotionValid(promotion: Prisma.PromotionGetPayload<{}>): boolean {
    if (!promotion.isActive) {
      return false;
    }

    const now = new Date();
    if (promotion.startDate > now || promotion.endDate < now) {
      return false;
    }

    if (promotion.usageLimit !== null && promotion.usageCount >= promotion.usageLimit) {
      return false;
    }

    return true;
  }
}

