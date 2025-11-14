/**
 * Create Payment DTO (Data Transfer Object)
 *
 * This DTO defines the structure for creating a payment via POST /payments endpoint.
 *
 * Purpose:
 * - Validate payment request data
 * - Ensure required fields are present
 * - Type safety for payment creation
 *
 * Validation Rules:
 * - orderId: Required, must be valid UUID
 * - amount: Required, must be positive number
 * - currency: Required, must be valid currency code
 * - paymentMethodType: Required, must be valid enum value
 * - customerEmail: Required, must be valid email
 */

import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  Min,
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { PaymentMethodType } from '../interfaces/payment-provider.interface';

/**
 * DTO for creating a payment
 */
export class CreatePaymentDto {
  /**
   * Order ID associated with this payment
   * Must be a valid UUID of an existing Order
   */
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  /**
   * Amount in cents (e.g., 10000 = $100.00)
   * Must be a positive number
   */
  @IsNumber()
  @Min(1, { message: 'Amount must be at least 1 cent' })
  amount: number;

  /**
   * Currency code (e.g., "USD", "EUR")
   * Must be a valid ISO 4217 currency code
   */
  @IsString()
  @IsNotEmpty()
  currency: string;

  /**
   * Payment method type
   * Determines which payment method to use
   */
  @IsEnum(PaymentMethodType)
  @IsNotEmpty()
  paymentMethodType: PaymentMethodType;

  /**
   * Customer email address
   * Used for receipts and notifications
   */
  @IsEmail()
  @IsNotEmpty()
  customerEmail: string;

  /**
   * Optional: Payment method ID (for saved cards)
   * If provided, uses saved payment method
   */
  @IsString()
  @IsOptional()
  paymentMethodId?: string;
}

