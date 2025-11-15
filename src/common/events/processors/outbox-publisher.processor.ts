/**
 * Outbox Publisher Processor
 *
 * This processor implements the worker side of the Transactional Outbox pattern.
 * It polls the Outbox table for unsent events and publishes them to the event bus.
 *
 * Responsibilities:
 * - Poll Outbox table for unsent events (periodically)
 * - Lock events to prevent concurrent processing
 * - Publish events to event bus (Redis Stream/Kafka)
 * - Mark events as sent after successful publishing
 * - Handle retries for failed events
 *
 * How It Works:
 * 1. Polls Outbox table for events where sentAt is null and locked is false
 * 2. Locks selected events (sets locked = true)
 * 3. Publishes events to Redis Stream (or Kafka in production)
 * 4. Marks events as sent (sets sentAt = current timestamp, locked = false)
 * 5. If publishing fails, increments attempts and unlocks for retry
 *
 * Configuration:
 * - Polling interval: 5 seconds (configurable)
 * - Batch size: 100 events per poll (configurable)
 * - Max attempts: 5 (configurable, after which events go to DLQ)
 *
 * Future Enhancements:
 * - Support for Kafka in addition to Redis Stream
 * - Dead Letter Queue (DLQ) for events that fail after max attempts
 * - Metrics for monitoring (events published, failures, latency)
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxService } from '../outbox.service';
import { RedisService } from '../../../lib/redis/redis.service';
import { PrometheusService } from '../../prometheus/prometheus.service';
import { Logger } from '../../../lib/logger';
import { DomainEvent } from '../interfaces/domain-event.interface';

/**
 * Configuration for OutboxPublisher
 */
interface OutboxPublisherConfig {
  /**
   * Polling interval in milliseconds
   * How often to check for new events
   */
  pollingInterval: number;

  /**
   * Batch size for processing events
   * Number of events to process per poll
   */
  batchSize: number;

  /**
   * Maximum number of publish attempts before giving up
   * After max attempts, event should go to DLQ
   */
  maxAttempts: number;
}

/**
 * OutboxPublisherProcessor polls and publishes events from Outbox table
 */
@Injectable()
export class OutboxPublisherProcessor implements OnModuleInit, OnModuleDestroy {
  private pollingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly config: OutboxPublisherConfig;

  constructor(
    private readonly outboxService: OutboxService,
    private readonly redisService: RedisService,
    private readonly prometheusService: PrometheusService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.config = {
      pollingInterval: this.configService.get<number>('OUTBOX_POLLING_INTERVAL', 5000) || 5000, // 5 seconds
      batchSize: Number(this.configService.get<string>('OUTBOX_BATCH_SIZE')) || 100,
      maxAttempts: Number(this.configService.get<string>('OUTBOX_MAX_ATTEMPTS')) || 5,
    };
  }

  /**
   * Start polling for events when module initializes
   */
  async onModuleInit(): Promise<void> {
    this.logger.log(
      `Starting OutboxPublisher (interval: ${this.config.pollingInterval}ms, batch: ${this.config.batchSize})`,
      'OutboxPublisherProcessor',
    );

    // Start polling immediately, then at intervals
    this.processEvents();
    this.pollingInterval = setInterval(() => {
      this.processEvents();
    }, this.config.pollingInterval);
  }

  /**
   * Stop polling when module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.logger.log('Stopped OutboxPublisher', 'OutboxPublisherProcessor');
  }

  /**
   * Process events from Outbox table.
   *
   * This method:
   * 1. Fetches unsent events
   * 2. Locks them
   * 3. Publishes to event bus
   * 4. Marks as sent
   *
   * Prevents concurrent execution with isProcessing flag.
   */
  private async processEvents(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      this.logger.debug('Already processing events, skipping poll', 'OutboxPublisherProcessor');
      return;
    }

    this.isProcessing = true;

    try {
      // Fetch unsent events
      const events = await this.outboxService.getUnsentEvents(this.config.batchSize);

      if (events.length === 0) {
        // No events to process
        return;
      }

      this.logger.debug(
        `Found ${events.length} unsent events, processing...`,
        'OutboxPublisherProcessor',
      );

      // Lock events to prevent concurrent processing
      const eventIds = events.map((e: any) => e.id);
      const lockedCount = await this.outboxService.lockEvents(eventIds);

      if (lockedCount === 0) {
        this.logger.debug('No events could be locked (already being processed)', 'OutboxPublisherProcessor');
        return;
      }

      // Filter to only locked events
      const lockedEvents = events.filter((e: any) => eventIds.slice(0, lockedCount).includes(e.id));

      // Publish events
      const publishResults = await Promise.allSettled(
        lockedEvents.map((event: any) => this.publishEvent(event)),
      );

      // Process results
      const successfulIds: string[] = [];
      const failedIds: string[] = [];

      publishResults.forEach((result: PromiseSettledResult<void>, index: number) => {
        if (result.status === 'fulfilled') {
          successfulIds.push(lockedEvents[index].id);
        } else {
          failedIds.push(lockedEvents[index].id);
          this.logger.error(
            `Failed to publish event ${lockedEvents[index].id}: ${result.reason}`,
            result.reason?.stack,
            'OutboxPublisherProcessor',
          );
        }
      });

      // Mark successful events as sent
      if (successfulIds.length > 0) {
        await this.outboxService.markAsSent(successfulIds);
        
        // Record metrics for successful publications
        lockedEvents
          .filter((e: any) => successfulIds.includes(e.id))
          .forEach((e: any) => {
            this.prometheusService.recordOutboxEventPublished(e.topic);
          });
        
        this.logger.debug(
          `Successfully published ${successfulIds.length} events`,
          'OutboxPublisherProcessor',
        );
      }

      // Increment attempts for failed events (and unlock for retry)
      if (failedIds.length > 0) {
        await this.outboxService.incrementAttempts(failedIds);
        
        // Record metrics for failed publications
        lockedEvents
          .filter((e: any) => failedIds.includes(e.id))
          .forEach((e: any) => {
            this.prometheusService.recordOutboxEventFailed(e.topic, 'publish_failed');
          });
        
        this.logger.warn(
          `Failed to publish ${failedIds.length} events (will retry)`,
          'OutboxPublisherProcessor',
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing events: ${error.message}`,
        error.stack,
        'OutboxPublisherProcessor',
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Publish a single event to the event bus.
   *
   * Currently publishes to Redis Stream. In production, can be extended
   * to support Kafka or other event buses.
   *
   * @param event - Outbox record containing event to publish
   * @returns Promise resolving when event is published
   */
  private async publishEvent(event: any): Promise<void> {
    const domainEvent = event.payload as DomainEvent;
    const topic = event.topic;

    // Check if event has exceeded max attempts
    if (event.attempts >= this.config.maxAttempts) {
      throw new Error(
        `Event ${event.id} exceeded max attempts (${this.config.maxAttempts}). Should be moved to DLQ.`,
      );
    }

    // Get Redis client
    const redisClient = this.redisService.getClient();
    if (!redisClient) {
      throw new Error('Redis client not available');
    }

    // Publish to Redis Stream
    // Stream key format: "events:{topic}"
    const streamKey = `events:${topic}`;

    try {
      // Add event to Redis Stream
      // XADD events:order.created * event_id <id> payload <json>
      // Note: ioredis uses lowercase method names
      await (redisClient as any).xadd(
        streamKey,
        '*', // Auto-generate message ID
        'event_id',
        domainEvent.event_id,
        'event_type',
        domainEvent.event_type,
        'payload',
        JSON.stringify(domainEvent),
      );

      this.logger.debug(
        `Published event ${domainEvent.event_id} to stream ${streamKey}`,
        'OutboxPublisherProcessor',
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish event to Redis Stream: ${error.message}`,
        error.stack,
        'OutboxPublisherProcessor',
      );
      throw error;
    }
  }
}

