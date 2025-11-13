/**
 * Order Response DTO (Data Transfer Object)
 *
 * This DTO defines the structure for order responses returned by the API.
 * It includes order details, status, and related information.
 *
 * Purpose:
 * - Standardize order response format
 * - Exclude sensitive/internal fields
 * - Include computed fields (total amount, item count, etc.)
 */

import { OrderStatus } from '@prisma/client';

/**
 * Order item in response (simplified, without full product details)
 */
export class OrderItemResponseDto {
  /**
   * Order item ID (if stored separately, otherwise use order ID + index)
   */
  id?: string;

  /**
   * Product variant SKU
   */
  sku: string;

  /**
   * Quantity ordered
   */
  quantity: number;

  /**
   * Price per unit at time of order
   */
  unitPrice: number;

  /**
   * Total price for this item (unitPrice * quantity)
   */
  totalPrice: number;
}

/**
 * Order response DTO
 */
export class OrderResponseDto {
  /**
   * Order unique identifier (UUID)
   */
  id: string;

  /**
   * User ID who placed the order
   */
  userId: string;

  /**
   * Current order status
   */
  status: OrderStatus;

  /**
   * Total order amount (sum of all items)
   */
  totalAmount: number;

  /**
   * Currency code (e.g., "USD")
   */
  currency: string;

  /**
   * Order items
   */
  items: OrderItemResponseDto[];

  /**
   * When order was created
   */
  createdAt: Date;

  /**
   * When order was last updated
   */
  updatedAt: Date;
}

