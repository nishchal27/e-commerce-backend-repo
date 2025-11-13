/**
 * Refund Payment DTO (Data Transfer Object)
 *
 * This DTO defines the structure for refunding a payment via POST /payments/:id/refund endpoint.
 *
 * Purpose:
 * - Validate refund request data
 * - Ensure payment intent ID is provided
 * - Type safety for refund operations
 */

import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

/**
 * DTO for refunding a payment
 */
export class RefundPaymentDto {
  /**
   * Payment intent ID to refund
   * Must be a valid payment intent ID from the payment provider
   */
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;

  /**
   * Optional: Amount to refund in cents
   * If not provided, full refund is processed
   * Must be positive number if provided
   */
  @IsNumber()
  @Min(1)
  @IsOptional()
  amount?: number;

  /**
   * Optional: Reason for refund
   * Examples: "duplicate", "fraudulent", "requested_by_customer"
   */
  @IsString()
  @IsOptional()
  reason?: string;
}

