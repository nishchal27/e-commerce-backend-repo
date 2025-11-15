/**
 * Worker Monitoring Service
 *
 * This service monitors BullMQ queues and workers.
 * It collects metrics about queue health, job counts, and worker status.
 *
 * Responsibilities:
 * - Monitor queue health (active, waiting, completed, failed jobs)
 * - Collect queue metrics for Prometheus
 * - Provide health check endpoints
 * - Detect queue issues (backlog, failures)
 *
 * How It Works:
 * 1. Periodically polls all BullMQ queues
 * 2. Collects queue statistics (job counts, delays)
 * 3. Updates Prometheus metrics
 * 4. Provides health check data
 *
 * Configuration:
 * - Polling interval: 30 seconds (configurable)
 * - Monitors all registered queues
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrometheusService } from '../../prometheus/prometheus.service';
import { Logger } from '../../../lib/logger';

/**
 * Queue health status
 */
export interface QueueHealth {
  /**
   * Queue name
   */
  queue: string;

  /**
   * Number of active jobs
   */
  active: number;

  /**
   * Number of waiting jobs
   */
  waiting: number;

  /**
   * Number of completed jobs
   */
  completed: number;

  /**
   * Number of failed jobs
   */
  failed: number;

  /**
   * Number of delayed jobs
   */
  delayed: number;

  /**
   * Is queue healthy? (no excessive backlog or failures)
   */
  healthy: boolean;

  /**
   * Health issues (if any)
   */
  issues: string[];
}

/**
 * WorkerMonitoringService monitors BullMQ queues
 */
@Injectable()
export class WorkerMonitoringService implements OnModuleInit, OnModuleDestroy {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly pollingInterval: number;
  private readonly queues: Map<string, Queue> = new Map();

  constructor(
    @Optional() @InjectQueue('mail') private readonly mailQueue: Queue | null,
    @InjectQueue('webhook-retry') private readonly webhookRetryQueue: Queue,
    @InjectQueue('payment-reconciliation') private readonly paymentReconciliationQueue: Queue,
    private readonly prometheusService: PrometheusService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.pollingInterval = this.configService.get<number>('WORKER_MONITORING_INTERVAL', 30000); // 30 seconds

    // Register all queues (mail queue is optional, registered in MailerModule)
    if (this.mailQueue) {
      this.queues.set('mail', this.mailQueue);
    }
    this.queues.set('webhook-retry', this.webhookRetryQueue);
    this.queues.set('payment-reconciliation', this.paymentReconciliationQueue);
  }

  /**
   * Start monitoring when module initializes
   */
  async onModuleInit(): Promise<void> {
    this.logger.log(
      `Starting worker monitoring (interval: ${this.pollingInterval}ms)`,
      'WorkerMonitoringService',
    );

    // Start monitoring immediately, then at intervals
    await this.collectMetrics();
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics().catch((error) => {
        this.logger.error(
          `Error collecting worker metrics: ${error.message}`,
          error.stack,
          'WorkerMonitoringService',
        );
      });
    }, this.pollingInterval);
  }

  /**
   * Stop monitoring when module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.logger.log('Stopped worker monitoring', 'WorkerMonitoringService');
  }

  /**
   * Collect metrics from all queues.
   *
   * This method:
   * 1. Polls each queue for statistics
   * 2. Updates Prometheus metrics
   * 3. Logs queue health
   */
  private async collectMetrics(): Promise<void> {
    for (const [queueName, queue] of this.queues.entries()) {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);

        // Update Prometheus metrics
        this.prometheusService.updateWorkerMetrics(
          queueName,
          active,
          waiting,
          completed,
          failed,
        );

        // Log if there are issues
        if (waiting > 100 || failed > 50) {
          this.logger.warn(
            `Queue health warning: ${queueName} (waiting: ${waiting}, active: ${active}, failed: ${failed}, delayed: ${delayed})`,
            'WorkerMonitoringService',
          );
        } else {
          this.logger.debug(
            `Queue metrics collected: ${queueName} (waiting: ${waiting}, active: ${active}, completed: ${completed}, failed: ${failed})`,
            'WorkerMonitoringService',
          );
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to collect metrics for queue ${queueName}: ${error.message}`,
          error.stack,
          'WorkerMonitoringService',
        );
      }
    }
  }

  /**
   * Get health status for all queues.
   *
   * @returns Array of queue health statuses
   */
  async getQueueHealth(): Promise<QueueHealth[]> {
    const healthStatuses: QueueHealth[] = [];

    for (const [queueName, queue] of this.queues.entries()) {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);

        const issues: string[] = [];
        let healthy = true;

        // Check for issues
        if (waiting > 100) {
          issues.push(`High backlog: ${waiting} waiting jobs`);
          healthy = false;
        }

        if (failed > 50) {
          issues.push(`High failure rate: ${failed} failed jobs`);
          healthy = false;
        }

        if (delayed > 1000) {
          issues.push(`High delayed jobs: ${delayed}`);
          healthy = false;
        }

        healthStatuses.push({
          queue: queueName,
          active,
          waiting,
          completed,
          failed,
          delayed,
          healthy,
          issues,
        });
      } catch (error: any) {
        this.logger.error(
          `Failed to get health for queue ${queueName}: ${error.message}`,
          error.stack,
          'WorkerMonitoringService',
        );

        healthStatuses.push({
          queue: queueName,
          active: 0,
          waiting: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          healthy: false,
          issues: [`Failed to query queue: ${error.message}`],
        });
      }
    }

    return healthStatuses;
  }

  /**
   * Get health status for a specific queue.
   *
   * @param queueName - Queue name
   * @returns Queue health status
   */
  async getQueueHealthByName(queueName: string): Promise<QueueHealth | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    const allHealth = await this.getQueueHealth();
    return allHealth.find((h) => h.queue === queueName) || null;
  }
}

