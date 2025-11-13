/**
 * Create Order DTO (Data Transfer Object)
 *
 * This DTO defines the structure for creating a new order via POST /orders endpoint.
 *
 * Purpose:
 * - Validate request data
 * - Ensure required fields are present
 * - Type safety for order creation
 *
 * Validation Rules:
 * - userId: Required, must be valid UUID
 * - items: Required, must be non-empty array
 * - idempotencyKey: Optional, but recommended for idempotent order creation
 * - Each item must have valid sku and quantity
 */

import {
  IsUUID,
  IsArray,
  IsNotEmpty,
  ValidateNested,
  IsInt,
  Min,
  IsOptional,
  IsString,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for an order item (product variant with quantity)
 */
export class CreateOrderItemDto {
  /**
   * Product variant SKU (Stock Keeping Unit)
   * Must match an existing ProductVariant.sku
   */
  @IsString()
  @IsNotEmpty()
  sku: string;

  /**
   * Quantity of this item in the order
   * Must be at least 1
   */
  @IsInt()
  @Min(1)
  quantity: number;
}

/**
 * DTO for creating a new order
 */
export class CreateOrderDto {
  /**
   * User ID who is placing the order
   * Must be a valid UUID of an existing User
   */
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  /**
   * Array of order items (product variants with quantities)
   * Must contain at least one item
   */
  @IsArray()
  @ArrayMinSize(1, { message: 'Order must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  /**
   * Idempotency key for preventing duplicate order creation
   * If provided, order creation is idempotent (same key = same order)
   * Recommended for retry scenarios
   *
   * Format: UUID or client-generated unique string
   */
  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

