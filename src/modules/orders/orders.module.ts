/**
 * Orders Module
 *
 * This module encapsulates all order-related functionality:
 * - OrdersController: HTTP endpoints
 * - OrdersService: Business logic (order creation, status management)
 * - OrdersRepository: Data access layer
 *
 * Responsibilities:
 * - Order creation with idempotency
 * - Order status state machine
 * - Event emission via Outbox pattern
 * - Integration with Products module (for price calculation)
 *
 * Integration:
 * - Uses PrismaModule for database access
 * - Uses EventsModule for event publishing (OutboxService)
 * - Uses PrometheusModule for metrics
 * - Uses AuthModule guards for authentication/authorization
 */

import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { PrismaModule } from '../../lib/prisma/prisma.module';
import { EventsModule } from '../../common/events/events.module';
import { PrometheusModule } from '../../common/prometheus/prometheus.module';

/**
 * OrdersModule provides order management functionality
 */
@Module({
  imports: [
    // Prisma for database access
    PrismaModule,
    // Events module for OutboxService (event publishing)
    EventsModule,
    // Prometheus for metrics
    PrometheusModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersService], // Export service for use in other modules (e.g., Payments)
})
export class OrdersModule {}

