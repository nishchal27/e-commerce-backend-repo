/**
 * Price History Repository
 *
 * This repository abstracts database operations for price history.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { CreatePriceHistoryDto } from './dto/create-price-history.dto';
import { Prisma } from '@prisma/client';

/**
 * PriceHistoryRepository handles all database operations for price history
 */
@Injectable()
export class PriceHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find price history for a variant.
   *
   * @param variantId - Variant UUID
   * @param limit - Maximum number of records to return (default: 100)
   * @returns Array of price history records
   */
  async findByVariantId(
    variantId: string,
    limit: number = 100,
  ): Promise<Prisma.PriceHistoryGetPayload<{}>[]> {
    return this.prisma.priceHistory.findMany({
      where: { variantId },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Find price history by ID.
   *
   * @param id - Price history UUID
   * @returns Price history or null if not found
   */
  async findById(id: string): Promise<Prisma.PriceHistoryGetPayload<{}> | null> {
    return this.prisma.priceHistory.findUnique({
      where: { id },
      include: {
        variant: true,
      },
    });
  }

  /**
   * Create a new price history record.
   *
   * @param data - Price history creation data
   * @returns Created price history
   */
  async create(data: CreatePriceHistoryDto): Promise<Prisma.PriceHistoryGetPayload<{}>> {
    return this.prisma.priceHistory.create({
      data: {
        variantId: data.variantId,
        price: data.price,
        compareAtPrice: data.compareAtPrice,
        reason: data.reason,
        changedBy: data.changedBy,
      },
      include: {
        variant: true,
      },
    });
  }

  /**
   * Get price history for multiple variants.
   *
   * @param variantIds - Array of variant UUIDs
   * @param limit - Maximum number of records per variant (default: 50)
   * @returns Map of variantId to price history array
   */
  async findByVariantIds(
    variantIds: string[],
    limit: number = 50,
  ): Promise<Map<string, Prisma.PriceHistoryGetPayload<{}>[]>> {
    const histories = await this.prisma.priceHistory.findMany({
      where: {
        variantId: { in: variantIds },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group by variantId
    const map = new Map<string, Prisma.PriceHistoryGetPayload<{}>[]>();
    for (const history of histories) {
      const existing = map.get(history.variantId) || [];
      if (existing.length < limit) {
        existing.push(history);
        map.set(history.variantId, existing);
      }
    }

    return map;
  }

  /**
   * Get latest price for a variant.
   *
   * @param variantId - Variant UUID
   * @returns Latest price history or null
   */
  async findLatestByVariantId(variantId: string): Promise<Prisma.PriceHistoryGetPayload<{}> | null> {
    return this.prisma.priceHistory.findFirst({
      where: { variantId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}

