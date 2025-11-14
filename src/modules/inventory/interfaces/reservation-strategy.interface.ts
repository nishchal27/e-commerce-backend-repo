/**
 * Reservation Strategy Interface
 *
 * This file defines the abstraction for inventory reservation strategies.
 * Different strategies can be used for reserving inventory (optimistic vs pessimistic locking).
 *
 * Purpose:
 * - Abstract reservation logic
 * - Enable A/B testing of different strategies
 * - Easy to test (mock strategies)
 * - Easy to swap strategies
 *
 * Strategy Pattern:
 * - Interface defines contract
 * - Each strategy (Optimistic, Pessimistic) implements interface
 * - InventoryService uses strategy abstraction
 * - Strategy selected via feature flag/experiment
 */

import { InventoryReservationStatus } from '@prisma/client';

/**
 * Reservation result
 */
export interface ReservationResult {
  /**
   * Reservation ID (if successful)
   */
  reservationId?: string;

  /**
   * Whether reservation was successful
   */
  success: boolean;

  /**
   * Error message (if reservation failed)
   */
  error?: string;

  /**
   * Available stock after reservation
   */
  availableStock?: number;
}

/**
 * Reservation data
 */
export interface ReservationData {
  /**
   * Product variant SKU ID
   */
  skuId: string;

  /**
   * Quantity to reserve
   */
  quantity: number;

  /**
   * Who is reserving (order ID or session ID)
   */
  reservedBy: string;

  /**
   * Reservation expiration time (TTL in seconds)
   */
  ttlSeconds?: number;
}

/**
 * Commit reservation data
 */
export interface CommitReservationData {
  /**
   * Reservation ID to commit
   */
  reservationId: string;

  /**
   * Order ID (if committing for an order)
   */
  orderId?: string;
}

/**
 * Release reservation data
 */
export interface ReleaseReservationData {
  /**
   * Reservation ID to release
   */
  reservationId: string;

  /**
   * Reason for release (optional)
   */
  reason?: string;
}

/**
 * Reservation Strategy Interface
 *
 * All reservation strategies must implement this interface.
 * This ensures consistent behavior across different strategies.
 */
export interface IReservationStrategy {
  /**
   * Strategy name (e.g., "optimistic", "pessimistic")
   */
  readonly name: string;

  /**
   * Reserve inventory.
   *
   * This method reserves stock for a specific SKU.
   * The implementation depends on the strategy:
   * - Optimistic: Check stock, reserve if available (race condition possible)
   * - Pessimistic: Lock stock, then reserve (no race condition)
   *
   * @param data - Reservation data
   * @returns Reservation result
   */
  reserve(data: ReservationData): Promise<ReservationResult>;

  /**
   * Commit a reservation.
   *
   * This method commits a reservation (marks as CONSUMED).
   * Used when an order is placed and paid.
   *
   * @param data - Commit reservation data
   * @returns Success status
   */
  commit(data: CommitReservationData): Promise<boolean>;

  /**
   * Release a reservation.
   *
   * This method releases a reservation (marks as RELEASED).
   * Used when cart is abandoned or checkout is cancelled.
   * Stock is returned to available inventory.
   *
   * @param data - Release reservation data
   * @returns Success status
   */
  release(data: ReleaseReservationData): Promise<boolean>;
}

