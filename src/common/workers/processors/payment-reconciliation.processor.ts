/**
 * Payment Reconciliation Processor
 *
 * This processor handles payment reconciliation with payment providers.
 * It periodically checks for payment discrepancies and reconciles them.
 *
 * Responsibilities:
 * - Reconcile payments with provider (check status matches)
 * - Detect discrepancies (payment succeeded in provider but not in DB)
 * - Update payment status if needed
 * - Emit reconciliation events
 *
 * How It Works:
 * 1. Processor runs periodically (cron job or scheduled)
 * 2. Fetches payments that need reconciliation (PENDING, PROCESSING)
 * 3. Checks payment status with provider
 * 4. Updates payment status if different
 * 5. Updates order status if payment succeeded
 * 6. Emits reconciliation events
 *
 * Configuration:
 * - Runs every 5 minutes (configurable)
 * - Batch size: 50 payments per run
 * - Only reconciles payments older than 1 minute (avoid race conditions)
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../lib/prisma/prisma.service';
import { PaymentsService } from '../../../modules/payments/payments.service';
import { PrometheusService } from '../../prometheus/prometheus.service';
import { OutboxService } from '../../events/outbox.service';
import { PaymentStatus, OrderStatus } from '@prisma/client';

/**
 * Payment reconciliation job data
 */
interface ReconciliationJobData {
  /**
   * Payment ID to reconcile
   */
  paymentId: string;

  /**
   * Payment intent ID from provider
   */
  paymentIntentId: string;

  /**
   * Provider name
   */
  provider: string;
}

/**
 * PaymentReconciliationProcessor processes payment reconciliation jobs
 */
@Processor('payment-reconciliation', {
  // Configuration for the processor
  concurrency: 2, // Process up to 2 reconciliations concurrently
  limiter: {
    max: 20, // Maximum 20 reconciliations per interval
    duration: 60000, // Per minute (60000ms)
  },
})
@Injectable()
export class PaymentReconciliationProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentReconciliationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly prometheusService: PrometheusService,
    private readonly outboxService: OutboxService,
  ) {
    super();
  }

  /**
   * Process payment reconciliation job.
   *
   * This method:
   * 1. Fetches payment from database
   * 2. Checks payment status with provider
   * 3. Updates payment status if different
   * 4. Updates order status if payment succeeded
   * 5. Records metrics
   *
   * @param job - Reconciliation job from queue
   * @returns Promise resolving when reconciliation is complete
   */
  async process(job: Job<ReconciliationJobData>): Promise<void> {
    const { paymentId, paymentIntentId, provider } = job.data;

    this.logger.debug(`Processing payment reconciliation: ${paymentId} (${paymentIntentId})`);

    const startTime = Date.now();

    try {
      // Get payment from database
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { order: true },
      });

      if (!payment) {
        throw new Error(`Payment not found: ${paymentId}`);
      }

      // Skip if payment is already in final state
      if (
        payment.status === PaymentStatus.SUCCEEDED ||
        payment.status === PaymentStatus.FAILED ||
        payment.status === PaymentStatus.CANCELLED
      ) {
        this.logger.debug(
          `Payment ${paymentId} already in final state: ${payment.status}, skipping reconciliation`,
        );
        return;
      }

      // Get payment status from provider
      // Note: This requires access to payment provider
      // For now, we'll use a placeholder - in production, call provider API
      const providerStatus = await this.getProviderPaymentStatus(paymentIntentId, provider);

      const latencySeconds = (Date.now() - startTime) / 1000;

      // Compare statuses
      if (providerStatus.status !== payment.status) {
        // Status mismatch - need to reconcile
        this.logger.warn(
          `Payment status mismatch: DB=${payment.status}, Provider=${providerStatus.status} for payment ${paymentId}`,
        );

        // Update payment status
        await this.reconcilePaymentStatus(payment, providerStatus.status);

        // Record reconciliation metric
        this.prometheusService.recordPaymentReconciliation(paymentId, true, latencySeconds);
      } else {
        // Status matches - no action needed
        this.logger.debug(`Payment ${paymentId} status matches provider: ${payment.status}`);
        this.prometheusService.recordPaymentReconciliation(paymentId, false, latencySeconds);
      }
    } catch (error: any) {
      const latencySeconds = (Date.now() - startTime) / 1000;

      this.logger.error(
        `Failed to reconcile payment ${paymentId}: ${error.message}`,
        error.stack,
      );

      this.prometheusService.recordPaymentReconciliation(paymentId, false, latencySeconds);

      // Don't throw - allow job to complete (will be retried if needed)
      // In production, you might want to throw for certain errors
    }
  }

  /**
   * Get payment status from provider.
   *
   * @param paymentIntentId - Payment intent ID
   * @param provider - Provider name
   * @returns Payment status from provider
   */
  private async getProviderPaymentStatus(
    paymentIntentId: string,
    provider: string,
  ): Promise<{ status: PaymentStatus }> {
    // TODO: Implement actual provider API call
    // For now, return placeholder
    // In production, this would call Stripe/PayPal API

    this.logger.warn(
      `Provider status check not fully implemented for ${provider}. Payment intent: ${paymentIntentId}`,
    );

    // Placeholder: Return PENDING (in production, call provider API)
    return { status: PaymentStatus.PENDING };
  }

  /**
   * Reconcile payment status.
   *
   * Updates payment and order status if payment succeeded.
   *
   * @param payment - Payment record
   * @param providerStatus - Status from provider
   */
  private async reconcilePaymentStatus(
    payment: any,
    providerStatus: PaymentStatus,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Update payment status
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: providerStatus },
      });

      // If payment succeeded, update order status
      if (providerStatus === PaymentStatus.SUCCEEDED && payment.order.status !== OrderStatus.PAID) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.PAID },
        });

        // Emit order.paid event
        await this.outboxService.writeEvent({
          topic: 'order.paid',
          event: this.outboxService.createEvent(
            'order.paid.v1',
            {
              order_id: payment.orderId,
              payment_id: payment.id,
              reconciled: true,
            },
            {},
          ),
        });
      }

      // Emit payment.reconciled event
      await this.outboxService.writeEvent({
        topic: 'payment.reconciled',
        event: this.outboxService.createEvent(
          'payment.reconciled.v1',
          {
            payment_id: payment.id,
            old_status: payment.status,
            new_status: providerStatus,
          },
          {},
        ),
      });
    });

    this.logger.log(
      `Payment ${payment.id} reconciled: ${payment.status} -> ${providerStatus}`,
    );
  }
}

