/**
 * Update Order Status DTO (Data Transfer Object)
 *
 * This DTO defines the structure for updating an order's status.
 * Used for status transitions (e.g., CREATED → PAID → SHIPPED → DELIVERED).
 *
 * Purpose:
 * - Validate status update requests
 * - Ensure valid status transitions
 * - Type safety for status updates
 */

import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';

/**
 * DTO for updating order status
 */
export class UpdateOrderStatusDto {
  /**
   * New order status
   * Must be a valid transition from current status
   */
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;

  /**
   * Optional reason/note for status change
   * Useful for tracking why status was changed (e.g., "Payment received", "Shipped via FedEx")
   */
  @IsString()
  @IsOptional()
  reason?: string;
}

