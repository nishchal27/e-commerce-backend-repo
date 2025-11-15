/**
 * Webhook Retry Processor
 *
 * This processor handles retrying failed webhook processing.
 * It uses BullMQ with exponential backoff to retry webhooks that failed to process.
 *
 * Responsibilities:
 * - Retry failed webhook processing
 * - Exponential backoff for retries
 * - Idempotent webhook processing
 * - Dead Letter Queue (DLQ) for permanently failed webhooks
 *
 * How It Works:
 * 1. Webhook processing fails in PaymentsService
 * 2. Webhook job is queued to "webhook-retry" queue
 * 3. This processor picks up the job
 * 4. Retries webhook processing via PaymentsService
 * 5. On success: Job completes
 * 6. On failure: Job retries with exponential backoff
 * 7. After max attempts: Job moves to DLQ
 *
 * Configuration:
 * - Max attempts: 5 (configurable)
 * - Exponential backoff: 2s, 4s, 8s, 16s, 32s
 * - Concurrency: 3 webhooks at once
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PaymentsService } from '../../../modules/payments/payments.service';
import { WebhookJobData } from '../interfaces/webhook-job.interface';
import { PrometheusService } from '../../prometheus/prometheus.service';

/**
 * WebhookRetryProcessor processes failed webhook jobs with retries
 */
@Processor('webhook-retry', {
  // Configuration for the processor
  concurrency: 3, // Process up to 3 webhooks concurrently
  limiter: {
    max: 10, // Maximum 10 webhooks per interval
    duration: 1000, // Per second (1000ms)
  },
})
@Injectable()
export class WebhookRetryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookRetryProcessor.name);

  constructor(
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly prometheusService: PrometheusService,
  ) {
    super();
  }

  /**
   * Process webhook retry job.
   *
   * This method:
   * 1. Extracts webhook data from job
   * 2. Retries webhook processing via PaymentsService
   * 3. Records metrics
   * 4. Handles success/failure
   *
   * @param job - Webhook retry job from queue
   * @returns Promise resolving when webhook is processed
   */
  async process(job: Job<WebhookJobData>): Promise<void> {
    const { paymentId, webhookEventId, eventType, payload, signature, provider, attemptNumber } =
      job.data;

    this.logger.debug(
      `Processing webhook retry job ${job.id}: ${eventType} (attempt ${attemptNumber})`,
    );

    const startTime = Date.now();

    try {
      // Retry webhook processing
      await this.paymentsService.processWebhook(payload, signature);

      const latencySeconds = (Date.now() - startTime) / 1000;

      // Record success metric
      this.prometheusService.recordWebhookRetrySuccess(provider, latencySeconds);

      this.logger.log(
        `Webhook processed successfully: ${webhookEventId} (attempt ${attemptNumber}, latency: ${latencySeconds}s)`,
      );
    } catch (error: any) {
      const latencySeconds = (Date.now() - startTime) / 1000;
      const errorMessage = error.message || 'Unknown error';

      // Record failure metric
      this.prometheusService.recordWebhookRetryFailure(provider, errorMessage, latencySeconds);

      this.logger.error(
        `Failed to process webhook: ${webhookEventId} (attempt ${attemptNumber}): ${errorMessage}`,
        error.stack,
      );

      // Update job data with error for next retry
      await job.updateData({
        ...job.data,
        lastError: errorMessage,
        attemptNumber: attemptNumber + 1,
      });

      // Throw error to trigger retry mechanism
      // BullMQ will automatically retry with exponential backoff
      throw error;
    }
  }
}

