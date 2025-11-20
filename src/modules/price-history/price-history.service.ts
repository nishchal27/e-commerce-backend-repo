/**
 * Price History Service
 *
 * This service contains the business logic for price history operations.
 * Price history is typically created automatically when product variant prices change.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PriceHistoryRepository } from './price-history.repository';
import { CreatePriceHistoryDto } from './dto/create-price-history.dto';
import { PriceHistoryResponseDto } from './dto/price-history-response.dto';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { Logger } from '../../lib/logger';

/**
 * PriceHistoryService handles business logic for price history operations
 */
@Injectable()
export class PriceHistoryService {
  constructor(
    private readonly priceHistoryRepository: PriceHistoryRepository,
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  /**
   * Get price history for a variant.
   *
   * @param variantId - Variant UUID
   * @param limit - Maximum number of records to return (default: 100)
   * @returns Array of price history records
   * @throws NotFoundException if variant not found
   */
  async getByVariantId(variantId: string, limit: number = 100): Promise<PriceHistoryResponseDto[]> {
    // Verify variant exists
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant with ID ${variantId} not found`);
    }

    return this.priceHistoryRepository.findByVariantId(variantId, limit);
  }

  /**
   * Get latest price for a variant.
   *
   * @param variantId - Variant UUID
   * @returns Latest price history or null
   */
  async getLatestByVariantId(variantId: string): Promise<PriceHistoryResponseDto | null> {
    return this.priceHistoryRepository.findLatestByVariantId(variantId);
  }

  /**
   * Create a price history record.
   * This is typically called automatically when a product variant price is updated.
   *
   * @param createDto - Price history creation data
   * @returns Created price history
   * @throws NotFoundException if variant not found
   */
  async create(createDto: CreatePriceHistoryDto): Promise<PriceHistoryResponseDto> {
    // Verify variant exists
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: createDto.variantId },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant with ID ${createDto.variantId} not found`);
    }

    const priceHistory = await this.priceHistoryRepository.create(createDto);
    this.logger.debug(
      `Price history created: ${priceHistory.id} for variant ${createDto.variantId} (price: ${createDto.price})`,
      'PriceHistoryService',
    );

    return priceHistory;
  }

  /**
   * Record price change automatically.
   * This method should be called when a product variant price is updated.
   *
   * @param variantId - Variant UUID
   * @param newPrice - New price
   * @param newCompareAtPrice - New compare at price (optional)
   * @param reason - Reason for price change
   * @param changedBy - User ID or system identifier
   * @returns Created price history
   */
  async recordPriceChange(
    variantId: string,
    newPrice: number,
    newCompareAtPrice?: number | null,
    reason?: string,
    changedBy?: string,
  ): Promise<PriceHistoryResponseDto> {
    return this.create({
      variantId,
      price: newPrice,
      compareAtPrice: newCompareAtPrice,
      reason: reason || 'price_update',
      changedBy,
    });
  }
}

