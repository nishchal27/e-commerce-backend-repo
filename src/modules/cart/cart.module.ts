/**
 * Cart Module
 *
 * This module encapsulates all cart-related functionality:
 * - CartController: HTTP endpoints
 * - CartService: Business logic (cart management, merging)
 *
 * Responsibilities:
 * - Cart management (add, update, remove items)
 * - Cart merging (anonymous → authenticated user)
 * - Price calculation
 * - Cart expiration (TTL via Redis)
 * - Integration with Products module (for product details)
 *
 * Integration:
 * - Uses PrismaModule for database access (product details)
 * - Uses RedisModule for cart storage
 * - Uses EventsModule for event publishing (OutboxService)
 * - Uses AuthModule guards (optional, supports anonymous carts)
 */

import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { PrismaModule } from '../../lib/prisma/prisma.module';
import { RedisModule } from '../../lib/redis/redis.module';
import { EventsModule } from '../../common/events/events.module';

/**
 * CartModule provides cart management functionality
 */
@Module({
  imports: [
    // Prisma for product details
    PrismaModule,
    // Redis for cart storage
    RedisModule,
    // Events module for OutboxService (event publishing)
    EventsModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService], // Export service for use in other modules (e.g., Orders)
})
export class CartModule {}

