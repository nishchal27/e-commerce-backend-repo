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
 * Order item in response (from OrderItem model)
 */
export class OrderItemResponseDto {
  /**
   * Order item ID
   */
  id: string;

  /**
   * Product variant ID
   */
  variantId: string;

  /**
   * Product variant SKU (snapshot at time of order)
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

  /**
   * Discount amount applied to this item
   */
  discountAmount: number;

  /**
   * Variant attributes snapshot (size, color, etc.)
   */
  attributes: Record<string, any> | null;
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
   * Total order amount (after discounts, taxes, shipping)
   */
  totalAmount: number;

  /**
   * Subtotal amount (before discounts, taxes, shipping)
   */
  subtotalAmount: number;

  /**
   * Total discount amount applied
   */
  discountAmount: number;

  /**
   * Tax amount
   */
  taxAmount: number;

  /**
   * Shipping amount
   */
  shippingAmount: number;

  /**
   * Promotion code applied (if any)
   */
  promotionCode: string | null;

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

