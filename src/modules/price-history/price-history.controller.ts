/**
 * Price History Controller
 *
 * This controller handles HTTP requests for price history-related endpoints.
 *
 * Endpoints:
 * - GET /price-history/variant/:variantId - Get price history for a variant
 * - GET /price-history/variant/:variantId/latest - Get latest price for a variant
 */

import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { PriceHistoryService } from './price-history.service';
import { PriceHistoryResponseDto } from './dto/price-history-response.dto';

/**
 * PriceHistoryController handles HTTP requests for price history endpoints
 */
@Controller('price-history')
export class PriceHistoryController {
  constructor(private readonly priceHistoryService: PriceHistoryService) {}

  /**
   * GET /price-history/variant/:variantId
   * Get price history for a variant.
   *
   * Query parameters:
   * - limit: Maximum number of records to return (default: 100)
   *
   * @param variantId - Variant UUID
   * @param limit - Maximum number of records
   * @returns Array of price history records
   */
  @Get('variant/:variantId')
  async getByVariantId(
    @Param('variantId') variantId: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number = 100,
  ): Promise<PriceHistoryResponseDto[]> {
    return this.priceHistoryService.getByVariantId(variantId, limit);
  }

  /**
   * GET /price-history/variant/:variantId/latest
   * Get latest price for a variant.
   *
   * @param variantId - Variant UUID
   * @returns Latest price history or null
   */
  @Get('variant/:variantId/latest')
  async getLatestByVariantId(@Param('variantId') variantId: string): Promise<PriceHistoryResponseDto | null> {
    return this.priceHistoryService.getLatestByVariantId(variantId);
  }
}

