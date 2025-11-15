/**
 * Webhook Job Interface
 *
 * This file defines the structure for webhook retry jobs.
 * Used by the webhook retry worker to process failed webhooks.
 *
 * Purpose:
 * - Type safety for webhook retry jobs
 * - Consistent job data structure
 * - Easy to extend with additional fields
 */

/**
 * Webhook job data structure
 */
export interface WebhookJobData {
  /**
   * Payment ID (if webhook is for a payment)
   */
  paymentId?: string;

  /**
   * Order ID (if webhook is for an order)
   */
  orderId?: string;

  /**
   * Webhook event ID from provider (e.g., Stripe event ID)
   */
  webhookEventId: string;

  /**
   * Webhook event type (e.g., "payment_intent.succeeded")
   */
  eventType: string;

  /**
   * Raw webhook payload
   */
  payload: any;

  /**
   * Webhook signature (for verification)
   */
  signature: string;

  /**
   * Provider name (e.g., "stripe", "paypal")
   */
  provider: string;

  /**
   * Original attempt timestamp
   */
  originalAttemptAt: Date;

  /**
   * Number of retry attempts
   */
  attemptNumber: number;

  /**
   * Last error message (if any)
   */
  lastError?: string;
}

