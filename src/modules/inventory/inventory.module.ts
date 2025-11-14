/**
 * Inventory Module
 *
 * This module encapsulates all inventory-related functionality:
 * - InventoryController: HTTP endpoints
 * - InventoryService: Business logic (reservations, stock management)
 * - Reservation Strategies: Optimistic and Pessimistic
 *
 * Responsibilities:
 * - Inventory reservation (reserve, commit, release)
 * - Stock management
 * - Strategy selection (optimistic vs pessimistic)
 * - Integration with experiments (A/B testing)
 * - Event emission via Outbox pattern
 *
 * Integration:
 * - Uses PrismaModule for database access
 * - Uses EventsModule for event publishing (OutboxService)
 * - Uses PrometheusModule for metrics
 * - Uses AuthModule guards for authentication
 */

import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { OptimisticStrategy } from './strategies/optimistic.strategy';
import { PessimisticStrategy } from './strategies/pessimistic.strategy';
import { PrismaModule } from '../../lib/prisma/prisma.module';
import { EventsModule } from '../../common/events/events.module';
import { PrometheusModule } from '../../common/prometheus/prometheus.module';

/**
 * InventoryModule provides inventory management functionality
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
  controllers: [InventoryController],
  providers: [
    // Reservation strategies
    OptimisticStrategy,
    PessimisticStrategy,
    // Inventory service (uses strategies)
    InventoryService,
  ],
  exports: [InventoryService], // Export service for use in other modules (e.g., Orders, Cart)
})
export class InventoryModule {}

