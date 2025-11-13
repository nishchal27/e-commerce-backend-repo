/**
 * Payment Provider Interface
 *
 * This file defines the abstraction for payment providers (Stripe, PayPal, etc.).
 * All payment providers must implement this interface to ensure consistent behavior.
 *
 * Purpose:
 * - Abstract payment processing logic
 * - Enable multiple payment providers
 * - Easy to test (mock providers)
 * - Easy to swap providers
 *
 * Provider Pattern:
 * - Interface defines contract
 * - Each provider (Stripe, PayPal) implements interface
 * - PaymentsService uses provider abstraction
 * - Factory pattern selects provider based on configuration
 */

/**
 * Payment method types
 */
export enum PaymentMethodType {
  CARD = 'card',
  PAYPAL = 'paypal',
  BANK_TRANSFER = 'bank_transfer',
}

/**
 * Payment status
 */
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

/**
 * Payment intent data for creating a payment
 */
export interface CreatePaymentIntentData {
  /**
   * Order ID associated with this payment
   */
  orderId: string;

  /**
   * Amount in cents (e.g., 10000 = $100.00)
   */
  amount: number;

  /**
   * Currency code (e.g., "USD", "EUR")
   */
  currency: string;

  /**
   * Payment method type
   */
  paymentMethodType: PaymentMethodType;

  /**
   * Customer email (for receipts)
   */
  customerEmail: string;

  /**
   * Optional: Payment method ID (for saved cards)
   */
  paymentMethodId?: string;

  /**
   * Optional: Metadata for tracking
   */
  metadata?: Record<string, string>;
}

/**
 * Payment intent result
 */
export interface PaymentIntentResult {
  /**
   * Payment intent ID (provider-specific)
   */
  paymentIntentId: string;

  /**
   * Client secret for frontend confirmation (Stripe)
   */
  clientSecret?: string;

  /**
   * Payment status
   */
  status: PaymentStatus;

  /**
   * Amount in cents
   */
  amount: number;

  /**
   * Currency code
   */
  currency: string;
}

/**
 * Confirm payment data
 */
export interface ConfirmPaymentData {
  /**
   * Payment intent ID
   */
  paymentIntentId: string;

  /**
   * Payment method ID (if not already attached)
   */
  paymentMethodId?: string;
}

/**
 * Refund payment data
 */
export interface RefundPaymentData {
  /**
   * Payment intent ID to refund
   */
  paymentIntentId: string;

  /**
   * Amount to refund in cents (optional, full refund if not provided)
   */
  amount?: number;

  /**
   * Reason for refund
   */
  reason?: string;
}

/**
 * Webhook event from payment provider
 */
export interface PaymentWebhookEvent {
  /**
   * Event type (e.g., "payment_intent.succeeded", "charge.refunded")
   */
  type: string;

  /**
   * Event ID (for idempotency)
   */
  id: string;

  /**
   * Event data (provider-specific structure)
   */
  data: any;

  /**
   * Timestamp when event occurred
   */
  timestamp: Date;
}

/**
 * Payment Provider Interface
 *
 * All payment providers must implement this interface.
 * This ensures consistent behavior across different providers.
 */
export interface IPaymentProvider {
  /**
   * Provider name (e.g., "stripe", "paypal")
   */
  readonly name: string;

  /**
   * Create a payment intent.
   * This initiates a payment but doesn't charge the customer yet.
   *
   * @param data - Payment intent data
   * @returns Payment intent result
   */
  createPaymentIntent(data: CreatePaymentIntentData): Promise<PaymentIntentResult>;

  /**
   * Confirm a payment intent.
   * This actually charges the customer.
   *
   * @param data - Confirm payment data
   * @returns Payment intent result
   */
  confirmPayment(data: ConfirmPaymentData): Promise<PaymentIntentResult>;

  /**
   * Get payment intent status.
   *
   * @param paymentIntentId - Payment intent ID
   * @returns Payment intent result
   */
  getPaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult>;

  /**
   * Refund a payment.
   *
   * @param data - Refund payment data
   * @returns Refund result
   */
  refundPayment(data: RefundPaymentData): Promise<{
    refundId: string;
    amount: number;
    status: PaymentStatus;
  }>;

  /**
   * Verify webhook signature.
   * Ensures webhook events are from the payment provider.
   *
   * @param payload - Raw webhook payload
   * @param signature - Webhook signature header
   * @returns true if signature is valid, false otherwise
   */
  verifyWebhookSignature(payload: string, signature: string): boolean;

  /**
   * Parse webhook event from raw payload.
   *
   * @param payload - Raw webhook payload
   * @returns Parsed webhook event
   */
  parseWebhookEvent(payload: any): PaymentWebhookEvent;
}

