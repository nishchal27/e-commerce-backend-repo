/**
 * Events Module
 *
 * This module provides event-driven architecture infrastructure using the
 * Transactional Outbox pattern for reliable event publishing.
 *
 * Responsibilities:
 * - OutboxService: Write events to Outbox table (within transactions)
 * - OutboxPublisherProcessor: Poll and publish events from Outbox to event bus
 * - Domain event interfaces and types
 *
 * Architecture:
 * - Events are written to Outbox table in same transaction as business logic
 * - OutboxPublisherProcessor polls Outbox table periodically
 * - Events are published to Redis Stream (can be extended to Kafka)
 * - Guarantees at-least-once delivery
 *
 * Usage:
 * ```typescript
 * // In a service
 * import { EventsModule } from '../common/events/events.module';
 * import { OutboxService } from '../common/events/outbox.service';
 *
 * // Write event in transaction
 * await prisma.$transaction(async (tx) => {
 *   const order = await tx.order.create({ ... });
 *   await outboxService.writeEvent({
 *     topic: 'order.created',
 *     event: outboxService.createEvent('order.created.v1', { order_id: order.id }),
 *     tx
 *   });
 * });
 * ```
 *
 * Integration:
 * - Uses PrismaModule for database access
 * - Uses RedisModule for event bus (Redis Stream)
 * - Exports OutboxService for use in other modules
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../lib/prisma/prisma.module';
import { RedisModule } from '../../lib/redis/redis.module';
import { LoggerModule } from '../../lib/logger/logger.module';
import { PrometheusModule } from '../prometheus/prometheus.module';
import { OutboxService } from './outbox.service';
import { OutboxPublisherProcessor } from './processors/outbox-publisher.processor';

/**
 * EventsModule provides event-driven architecture infrastructure
 */
@Module({
  imports: [
    // Prisma for database access (Outbox table)
    PrismaModule,
    // Redis for event bus (Redis Stream)
    RedisModule,
    // Logger for structured logging
    LoggerModule,
    // Prometheus for metrics
    PrometheusModule,
  ],
  providers: [
    // OutboxService: Write events to Outbox table
    OutboxService,
    // OutboxPublisherProcessor: Poll and publish events
    OutboxPublisherProcessor,
  ],
  exports: [
    // Export OutboxService for use in other modules (Orders, Payments, etc.)
    OutboxService,
  ],
})
export class EventsModule {}

