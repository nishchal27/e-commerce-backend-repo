/**
 * Order Status Interface
 *
 * This file defines the order status state machine and related types.
 *
 * Order Lifecycle:
 * CREATED → PAID → SHIPPED → DELIVERED
 *   ↓
 * CANCELLED (can be cancelled from CREATED or PAID status)
 *
 * State Transitions:
 * - CREATED: Order created, payment pending
 * - PAID: Payment processed successfully
 * - SHIPPED: Order shipped to customer
 * - DELIVERED: Order delivered to customer
 * - CANCELLED: Order cancelled (refund processed if already paid)
 */

import { OrderStatus } from '@prisma/client';

/**
 * Valid order status transitions
 * Maps each status to the statuses it can transition to
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: [OrderStatus.PAID, OrderStatus.CANCELLED],
  PAID: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [], // Terminal state - no transitions allowed
  CANCELLED: [], // Terminal state - no transitions allowed
};

/**
 * Check if a status transition is valid
 *
 * @param fromStatus - Current order status
 * @param toStatus - Desired order status
 * @returns true if transition is valid, false otherwise
 */
export function isValidStatusTransition(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
): boolean {
  const allowedTransitions = ORDER_STATUS_TRANSITIONS[fromStatus];
  return allowedTransitions.includes(toStatus);
}

/**
 * Check if an order status is terminal (no further transitions)
 *
 * @param status - Order status to check
 * @returns true if status is terminal, false otherwise
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[status].length === 0;
}

