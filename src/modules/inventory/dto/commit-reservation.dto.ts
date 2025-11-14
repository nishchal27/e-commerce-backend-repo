/**
 * Commit Reservation DTO (Data Transfer Object)
 *
 * This DTO defines the structure for committing a reservation via POST /inventory/commit endpoint.
 *
 * Purpose:
 * - Validate commit request data
 * - Ensure reservation ID is provided
 * - Type safety for reservation commits
 */

import { IsUUID, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTO for committing a reservation
 */
export class CommitReservationDto {
  /**
   * Reservation ID to commit
   * Must be a valid UUID of an existing InventoryReservation
   */
  @IsUUID()
  @IsNotEmpty()
  reservationId: string;

  /**
   * Optional: Order ID (if committing for an order)
   * Used for tracking and audit purposes
   */
  @IsString()
  @IsOptional()
  orderId?: string;
}

