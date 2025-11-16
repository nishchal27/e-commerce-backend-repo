/**
 * Dead Letter Queue (DLQ) Handler Service
 *
 * This service handles jobs that have failed after maximum retry attempts.
 * It provides functionality to inspect, reprocess, or archive failed jobs.
 *
 * Responsibilities:
 * - Monitor failed jobs in queues
 * - Provide DLQ inspection and management
 * - Support manual reprocessing of failed jobs
 * - Archive permanently failed jobs
 *
 * How It Works:
 * 1. Jobs that fail after max attempts are kept in the failed queue
 * 2. This service monitors failed jobs
 * 3. Provides endpoints to inspect and manage failed jobs
 * 4. Supports manual reprocessing or archival
 *
 * Configuration:
 * - Failed jobs are kept for 7 days (configurable in queue options)
 * - After 7 days, jobs are automatically cleaned up
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PrometheusService } from '../../prometheus/prometheus.service';

/**
 * DLQ job information
 */
export interface DLQJobInfo {
  /**
   * Job ID
   */
  id: string;

  /**
   * Job name
   */
  name: string;

  /**
   * Job data
   */
  data: any;

  /**
   * Failure reason
   */
  failedReason: string;

  /**
   * Number of attempts
   */
  attemptsMade: number;

  /**
   * When job failed
   */
  failedAt: number;

  /**
   * Stack trace (if available)
   */
  stacktrace?: string[];
}

/**
 * DLQHandlerService manages dead letter queue jobs
 */
@Injectable()
export class DLQHandlerService {
  private readonly logger = new Logger(DLQHandlerService.name);
  private readonly queues: Map<string, Queue> = new Map();

  constructor(
    @Optional() @InjectQueue('mail') private readonly mailQueue: Queue | null,
    @InjectQueue('webhook-retry') private readonly webhookRetryQueue: Queue,
    @InjectQueue('payment-reconciliation') private readonly paymentReconciliationQueue: Queue,
    private readonly prometheusService: PrometheusService,
  ) {
    // Register all queues (mail queue is optional, registered in MailerModule)
    if (this.mailQueue) {
      this.queues.set('mail', this.mailQueue);
    }
    this.queues.set('webhook-retry', this.webhookRetryQueue);
    this.queues.set('payment-reconciliation', this.paymentReconciliationQueue);
  }

  /**
   * Get failed jobs from a queue.
   *
   * @param queueName - Queue name
   * @param limit - Maximum number of jobs to return
   * @returns Array of failed job information
   */
  async getFailedJobs(queueName: string, limit: number = 100): Promise<DLQJobInfo[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    try {
      const failedJobs = await queue.getFailed(0, limit - 1);

      return failedJobs.map((job: Job) => ({
        id: job.id!,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason || 'Unknown error',
        attemptsMade: job.attemptsMade,
        failedAt: job.timestamp || Date.now(),
        stacktrace: job.stacktrace,
      }));
    } catch (error: any) {
      this.logger.error(
        `Failed to get failed jobs from queue ${queueName}: ${error.message}`,
        error.stack,
        'DLQHandlerService',
      );
      throw error;
    }
  }

  /**
   * Retry a failed job.
   *
   * @param queueName - Queue name
   * @param jobId - Job ID
   * @returns Success status
   */
  async retryJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    try {
      const job = await queue.getJob(jobId);
      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      // Retry the job
      await job.retry();

      this.logger.log(`Retried failed job ${jobId} from queue ${queueName}`, 'DLQHandlerService');

      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to retry job ${jobId} from queue ${queueName}: ${error.message}`,
        error.stack,
        'DLQHandlerService',
      );
      throw error;
    }
  }

  /**
   * Remove a failed job (archive/delete).
   *
   * @param queueName - Queue name
   * @param jobId - Job ID
   * @returns Success status
   */
  async removeFailedJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    try {
      const job = await queue.getJob(jobId);
      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      // Remove the job
      await job.remove();

      this.logger.log(
        `Removed failed job ${jobId} from queue ${queueName}`,
        'DLQHandlerService',
      );

      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to remove job ${jobId} from queue ${queueName}: ${error.message}`,
        error.stack,
        'DLQHandlerService',
      );
      throw error;
    }
  }

  /**
   * Get count of failed jobs per queue.
   *
   * @returns Map of queue name to failed job count
   */
  async getFailedJobCounts(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    for (const [queueName, queue] of this.queues.entries()) {
      try {
        const count = await queue.getFailedCount();
        counts.set(queueName, count);
      } catch (error: any) {
        this.logger.error(
          `Failed to get failed job count for queue ${queueName}: ${error.message}`,
          error.stack,
          'DLQHandlerService',
        );
        counts.set(queueName, 0);
      }
    }

    return counts;
  }
}

