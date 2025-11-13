/**
 * Outbox Service
 *
 * This service implements the Transactional Outbox pattern for reliable event publishing.
 *
 * Problem Solved:
 * - Ensures events are never lost even if event bus is down
 * - Guarantees events are published in the same transaction as business logic
 * - Enables at-least-once delivery semantics
 *
 * How It Works:
 * 1. Business logic writes event to Outbox table in same database transaction
 * 2. OutboxPublisher worker polls Outbox table for unsent events
 * 3. Worker publishes events to event bus (Redis Stream/Kafka)
 * 4. Worker marks events as sent (sets sentAt timestamp)
 *
 * Usage:
 * ```typescript
 * // In a service method
 * await prisma.$transaction(async (tx) => {
 *   // Create order
 *   const order = await tx.order.create({ ... });
 *
 *   // Write event to outbox (same transaction)
 *   await outboxService.writeEvent(tx, {
 *     topic: 'order.created',
 *     event: {
 *       event_id: uuid(),
 *       event_type: 'order.created.v1',
 *       timestamp: new Date().toISOString(),
 *       source: 'orders-service',
 *       payload: { order_id: order.id, ... }
 *     }
 *   });
 * });
 * ```
 *
 * Responsibilities:
 * - Write events to Outbox table (within database transaction)
 * - Provide helper methods for event creation
 * - Support event correlation (trace_id, request_id)
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { DomainEvent, EventMetadata } from './interfaces/domain-event.interface';
import { Logger } from '../../lib/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Options for writing an event to the outbox
 */
export interface WriteEventOptions {
  /**
   * Event topic/channel (e.g., "order.created", "payment.succeeded")
   * Used for routing events to appropriate consumers
   */
  topic: string;

  /**
   * Domain event envelope
   * Must follow DomainEvent interface structure
   */
  event: DomainEvent;

  /**
   * Optional: Use existing Prisma transaction client
   * If provided, event is written in the same transaction
   * If not provided, a new transaction is created
   */
  tx?: Prisma.TransactionClient;
}

/**
 * OutboxService handles writing events to the Outbox table
 */
@Injectable()
export class OutboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  /**
   * Write an event to the Outbox table.
   *
   * This method should be called within a database transaction to ensure
   * the event is written atomically with the business logic.
   *
   * @param options - Event options (topic, event, optional transaction client)
   * @returns Created Outbox record
   *
   * @example
   * ```typescript
   * await prisma.$transaction(async (tx) => {
   *   const order = await tx.order.create({ ... });
   *   await outboxService.writeEvent({
   *     topic: 'order.created',
   *     event: {
   *       event_id: uuid(),
   *       event_type: 'order.created.v1',
   *       timestamp: new Date().toISOString(),
   *       source: 'orders-service',
   *       payload: { order_id: order.id }
   *     },
   *     tx // Use same transaction
   *   });
   * });
   * ```
   */
  async writeEvent(options: WriteEventOptions): Promise<void> {
    const { topic, event, tx } = options;

    // Validate event structure
    this.validateEvent(event);

    // Use provided transaction client or create new one
    const client = tx || this.prisma;

    try {
      // Write event to Outbox table
      // Note: After running Prisma generate, 'outbox' will be available on Prisma client
      await (client as any).outbox.create({
        data: {
          topic,
          payload: event as unknown as Prisma.JsonObject,
          // locked defaults to false, sentAt defaults to null, attempts defaults to 0
        },
      });

      this.logger.debug(
        `Event written to outbox: ${event.event_type} (topic: ${topic})`,
        'OutboxService',
      );
    } catch (error) {
      this.logger.error(
        `Failed to write event to outbox: ${error.message}`,
        error.stack,
        'OutboxService',
      );
      throw error;
    }
  }

  /**
   * Create a domain event with standard fields.
   *
   * Helper method to create properly formatted domain events.
   * Automatically sets event_id, timestamp, and source.
   *
   * @param eventType - Event type (e.g., "order.created.v1")
   * @param payload - Event payload (domain-specific data)
   * @param options - Optional: trace_id, request_id, metadata
   * @returns Formatted domain event
   *
   * @example
   * ```typescript
   * const event = outboxService.createEvent(
   *   'order.created.v1',
   *   { order_id: order.id, user_id: order.userId, total_amount: order.totalAmount },
   *   { trace_id: req.traceId, request_id: req.requestId }
   * );
   * ```
   */
  createEvent(
    eventType: string,
    payload: Record<string, any>,
    options?: {
      trace_id?: string;
      request_id?: string;
      meta?: EventMetadata;
    },
  ): DomainEvent {
    return {
      event_id: uuidv4(),
      event_type: eventType,
      timestamp: new Date().toISOString(),
      source: this.getServiceName(),
      trace_id: options?.trace_id,
      request_id: options?.request_id,
      payload,
      meta: options?.meta,
    };
  }

  /**
   * Get unsent events from the Outbox table.
   *
   * Used by OutboxPublisher worker to poll for events to publish.
   * Returns events that are not locked and not yet sent.
   *
   * @param limit - Maximum number of events to retrieve (default: 100)
   * @returns Array of unsent Outbox records
   */
  async getUnsentEvents(limit: number = 100) {
    // Note: After running Prisma generate, 'outbox' will be available
    return (this.prisma as any).outbox.findMany({
      where: {
        sentAt: null, // Not yet sent
        locked: false, // Not currently being processed
      },
      orderBy: {
        createdAt: 'asc', // Process oldest events first (FIFO)
      },
      take: limit,
    });
  }

  /**
   * Lock events for processing.
   *
   * Used by OutboxPublisher worker to prevent concurrent processing.
   * Atomically locks events that are not yet locked.
   *
   * @param ids - Array of Outbox record IDs to lock
   * @returns Number of events successfully locked
   */
  async lockEvents(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await (this.prisma as any).outbox.updateMany({
      where: {
        id: { in: ids },
        locked: false, // Only lock if not already locked
        sentAt: null, // Only lock if not yet sent
      },
      data: {
        locked: true,
      },
    });

    return result.count;
  }

  /**
   * Mark events as sent.
   *
   * Called by OutboxPublisher worker after successfully publishing events.
   * Sets sentAt timestamp and unlocks the events.
   *
   * @param ids - Array of Outbox record IDs to mark as sent
   */
  async markAsSent(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await (this.prisma as any).outbox.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        sentAt: new Date(),
        locked: false,
      },
    });

    this.logger.debug(
      `Marked ${ids.length} events as sent`,
      'OutboxService',
    );
  }

  /**
   * Increment attempt count for failed events.
   *
   * Called by OutboxPublisher worker when event publishing fails.
   * Unlocks the event so it can be retried later.
   *
   * @param ids - Array of Outbox record IDs to increment attempts
   */
  async incrementAttempts(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await (this.prisma as any).outbox.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        attempts: { increment: 1 },
        locked: false, // Unlock for retry
      },
    });

    this.logger.warn(
      `Incremented attempts for ${ids.length} events`,
      'OutboxService',
    );
  }

  /**
   * Validate event structure.
   *
   * Ensures event follows DomainEvent interface requirements.
   *
   * @param event - Event to validate
   * @throws Error if event is invalid
   */
  private validateEvent(event: DomainEvent): void {
    if (!event.event_id) {
      throw new Error('Event must have event_id');
    }
    if (!event.event_type) {
      throw new Error('Event must have event_type');
    }
    if (!event.timestamp) {
      throw new Error('Event must have timestamp');
    }
    if (!event.source) {
      throw new Error('Event must have source');
    }
    if (!event.payload) {
      throw new Error('Event must have payload');
    }
  }

  /**
   * Get service name for event source.
   *
   * Returns the service/module name to use in event.source field.
   * Can be overridden via environment variable or defaults to "e-commerce-backend".
   *
   * @returns Service name
   */
  private getServiceName(): string {
    // Can be configured via environment variable
    return process.env.SERVICE_NAME || 'e-commerce-backend';
  }
}

