/**
 * Create PriceHistory DTO
 *
 * DTO for creating price history records (typically done automatically when prices change).
 */

import { IsUUID, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO for creating a price history record
 */
export class CreatePriceHistoryDto {
  @IsUUID()
  @IsNotEmpty()
  variantId: string; // Product variant UUID

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  price: number; // Price at this point in time

  @IsNumber()
  @Min(0)
  @IsOptional()
  compareAtPrice?: number; // Compare at price

  @IsString()
  @IsOptional()
  reason?: string; // Reason for price change (e.g., "promotion", "cost_change")

  @IsString()
  @IsOptional()
  changedBy?: string; // User ID or system identifier who changed the price
}

