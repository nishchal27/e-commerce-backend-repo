/**
 * Add to Cart DTO (Data Transfer Object)
 *
 * This DTO defines the structure for adding items to cart via POST /cart/items endpoint.
 *
 * Purpose:
 * - Validate add to cart request data
 * - Ensure required fields are present
 * - Type safety for cart operations
 *
 * Validation Rules:
 * - skuId: Required, must be valid UUID
 * - quantity: Required, must be positive integer
 */

import { IsUUID, IsNotEmpty, IsInt, Min } from 'class-validator';

/**
 * DTO for adding item to cart
 */
export class AddToCartDto {
  /**
   * Product variant SKU ID
   * Must be a valid UUID of an existing ProductVariant
   */
  @IsUUID()
  @IsNotEmpty()
  skuId: string;

  /**
   * Quantity to add
   * Must be at least 1
   */
  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity: number;
}

