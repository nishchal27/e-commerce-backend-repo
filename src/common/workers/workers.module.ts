/**
 * Workers Module
 *
 * This module provides background worker functionality using BullMQ.
 * It includes processors for webhook retries, payment reconciliation, and worker monitoring.
 *
 * Responsibilities:
 * - Configure BullMQ queues for background workers
 * - Register worker processors
 * - Provide worker monitoring
 * - Export worker services
 *
 * Workers Included:
 * - WebhookRetryProcessor: Retries failed webhook processing
 * - PaymentReconciliationProcessor: Reconciles payments with providers
 * - WorkerMonitoringService: Monitors queue health
 */

import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { WebhookRetryProcessor } from './processors/webhook-retry.processor';
import { PaymentReconciliationProcessor } from './processors/payment-reconciliation.processor';
import { SearchIndexingProcessor } from './processors/search-indexing.processor';
import { WorkerMonitoringService } from './services/worker-monitoring.service';
import { DLQHandlerService } from './services/dlq-handler.service';
import { WorkersController } from './workers.controller';
import { PaymentsModule } from '../../modules/payments/payments.module';
import { PrismaModule } from '../../lib/prisma/prisma.module';
import { PrometheusModule } from '../prometheus/prometheus.module';
import { EventsModule } from '../events/events.module';
import { LoggerModule } from '../../lib/logger/logger.module';

/**
 * WorkersModule provides background worker functionality
 */
@Module({
  imports: [
    // Configuration
    ConfigModule,

    // Configure BullMQ connection (reuses Redis connection)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl =
          configService.get<string>('BULLMQ_REDIS_URL') ||
          configService.get<string>('REDIS_URL') ||
          'redis://localhost:6379';

        return {
          connection: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
            password: configService.get<string>('REDIS_PASSWORD'),
            ...(redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://')
              ? { url: redisUrl }
              : {}),
          },
        };
      },
      inject: [ConfigService],
    }),

    // Register webhook retry queue
    BullModule.registerQueue({
      name: 'webhook-retry',
      defaultJobOptions: {
        // Retry configuration
        attempts: 5, // Retry up to 5 times
        backoff: {
          type: 'exponential', // Exponential backoff
          delay: 2000, // Initial delay: 2 seconds (2s, 4s, 8s, 16s, 32s)
        },
        // Remove completed jobs after 1 hour
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        // Keep failed jobs for 7 days (for debugging and DLQ)
        removeOnFail: {
          age: 604800, // 7 days
        },
      },
    }),

    // Register payment reconciliation queue
    BullModule.registerQueue({
      name: 'payment-reconciliation',
      defaultJobOptions: {
        // Retry configuration
        attempts: 3, // Retry up to 3 times
        backoff: {
          type: 'exponential',
          delay: 5000, // Initial delay: 5 seconds
        },
        // Remove completed jobs after 24 hours
        removeOnComplete: {
          age: 86400,
          count: 50,
        },
        // Keep failed jobs for 7 days
        removeOnFail: {
          age: 604800,
        },
      },
    }),

    // Register search indexing queue
    BullModule.registerQueue({
      name: 'search-indexing',
      defaultJobOptions: {
        // Retry configuration
        attempts: 3, // Retry up to 3 times
        backoff: {
          type: 'exponential',
          delay: 2000, // Initial delay: 2 seconds
        },
        // Remove completed jobs after 1 hour
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        // Keep failed jobs for 7 days
        removeOnFail: {
          age: 604800,
        },
      },
    }),

    // Dependencies
    // Import PaymentsModule with forwardRef to avoid circular dependencies
    forwardRef(() => PaymentsModule), // For WebhookRetryProcessor
    PrismaModule, // For PaymentReconciliationProcessor
    PrometheusModule, // For metrics
    EventsModule, // For OutboxService
    LoggerModule, // For logging
  ],
  controllers: [
    // Worker monitoring endpoints
    WorkersController,
  ],
  providers: [
    // Worker processors
    WebhookRetryProcessor,
    PaymentReconciliationProcessor,
    SearchIndexingProcessor,

    // Worker monitoring and DLQ handling
    WorkerMonitoringService,
    DLQHandlerService,
  ],
  exports: [
    // Export monitoring service for health checks
    WorkerMonitoringService,
  ],
})
export class WorkersModule {}

