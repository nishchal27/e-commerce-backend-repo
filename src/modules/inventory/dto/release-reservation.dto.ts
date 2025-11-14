/**
 * Release Reservation DTO (Data Transfer Object)
 *
 * This DTO defines the structure for releasing a reservation via POST /inventory/release endpoint.
 *
 * Purpose:
 * - Validate release request data
 * - Ensure reservation ID is provided
 * - Type safety for reservation releases
 */

import { IsUUID, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTO for releasing a reservation
 */
export class ReleaseReservationDto {
  /**
   * Reservation ID to release
   * Must be a valid UUID of an existing InventoryReservation
   */
  @IsUUID()
  @IsNotEmpty()
  reservationId: string;

  /**
   * Optional: Reason for release
   * Examples: "cart_abandoned", "checkout_cancelled", "expired"
   */
  @IsString()
  @IsOptional()
  reason?: string;
}

