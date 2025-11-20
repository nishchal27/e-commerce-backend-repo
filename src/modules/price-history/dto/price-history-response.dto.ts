/**
 * Price History Response DTO
 *
 * DTO for price history API responses.
 */

/**
 * Price history response structure
 */
export class PriceHistoryResponseDto {
  id: string;
  variantId: string;
  price: number;
  compareAtPrice: number | null;
  reason: string | null;
  changedBy: string | null;
  createdAt: Date;
}

