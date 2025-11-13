/**
 * Confirm Payment DTO (Data Transfer Object)
 *
 * This DTO defines the structure for confirming a payment via POST /payments/:id/confirm endpoint.
 *
 * Purpose:
 * - Validate payment confirmation data
 * - Ensure payment intent ID is provided
 * - Type safety for payment confirmation
 */

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * DTO for confirming a payment
 */
export class ConfirmPaymentDto {
  /**
   * Payment intent ID to confirm
   * Must be a valid payment intent ID from the payment provider
   */
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;

  /**
   * Optional: Payment method ID (if not already attached to payment intent)
   */
  @IsString()
  @IsOptional()
  paymentMethodId?: string;
}

