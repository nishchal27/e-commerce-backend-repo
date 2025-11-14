/**
 * Reserve Inventory DTO (Data Transfer Object)
 *
 * This DTO defines the structure for reserving inventory via POST /inventory/reserve endpoint.
 *
 * Purpose:
 * - Validate reservation request data
 * - Ensure required fields are present
 * - Type safety for inventory reservations
 *
 * Validation Rules:
 * - skuId: Required, must be valid UUID
 * - quantity: Required, must be positive integer
 * - reservedBy: Required, must be non-empty string (order ID or session ID)
 * - ttlSeconds: Optional, must be positive integer if provided
 */

import {
  IsUUID,
  IsNotEmpty,
  IsInt,
  Min,
  IsString,
  IsOptional,
  IsPositive,
} from 'class-validator';

/**
 * DTO for reserving inventory
 */
export class ReserveInventoryDto {
  /**
   * Product variant SKU ID
   * Must be a valid UUID of an existing ProductVariant
   */
  @IsUUID()
  @IsNotEmpty()
  skuId: string;

  /**
   * Quantity to reserve
   * Must be at least 1
   */
  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity: number;

  /**
   * Who is reserving (order ID or session ID)
   * Used to track who reserved the inventory
   */
  @IsString()
  @IsNotEmpty()
  reservedBy: string;

  /**
   * Optional: Reservation TTL in seconds
   * Default: 900 seconds (15 minutes)
   * After TTL expires, reservation is automatically released
   */
  @IsInt()
  @IsPositive()
  @IsOptional()
  ttlSeconds?: number;
}

