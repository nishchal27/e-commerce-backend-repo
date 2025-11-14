/**
 * Update Cart Item DTO (Data Transfer Object)
 *
 * This DTO defines the structure for updating cart items via PATCH /cart/items/:skuId endpoint.
 *
 * Purpose:
 * - Validate update request data
 * - Ensure quantity is valid
 * - Type safety for cart updates
 */

import { IsInt, Min, IsOptional } from 'class-validator';

/**
 * DTO for updating cart item quantity
 */
export class UpdateCartItemDto {
  /**
   * New quantity
   * Must be at least 1
   * If 0, item is removed from cart
   */
  @IsInt()
  @Min(0, { message: 'Quantity must be at least 0' })
  quantity: number;
}

