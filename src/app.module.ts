/**
 * Root application module for the NestJS e-commerce backend.
 *
 * This module serves as the entry point for dependency injection and module composition.
 * It imports all feature modules (products, auth, etc.) and configures global providers
 * like configuration, logging, and database connections.
 */

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Feature modules
import { ProductsModule } from './modules/products/products.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailerModule } from './modules/mailer/mailer.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CartModule } from './modules/cart/cart.module';
import { WorkersModule } from './common/workers/workers.module';

// Common modules and utilities
import { LoggerModule } from './lib/logger/logger.module';
import { PrismaModule } from './lib/prisma/prisma.module';
import { RedisModule } from './lib/redis/redis.module';
import { PrometheusModule } from './common/prometheus/prometheus.module';
import { RateLimitModule } from './common/rate-limiting/rate-limit.module';
import { EventsModule } from './common/events/events.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { PrometheusMiddleware } from './common/prometheus/prometheus.middleware';

// Experiments module
import { ExperimentsModule } from './modules/experiments/experiments.module';

// Search module
import { SearchModule } from './modules/search/search.module';

// Recommendations module
import { RecommendationsModule } from './modules/recommendations/recommendations.module';

/**
 * AppModule - Root module of the application
 *
 * Responsibilities:
 * - Loads environment variables from .env files
 * - Imports all feature modules
 * - Configures global middleware (request ID tracking)
 * - Sets up shared services (Prisma, Redis, Prometheus)
 */
@Module({
  imports: [
    // Configuration module - loads environment variables from .env files
    // isGlobal: true makes ConfigService available throughout the app without re-importing
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'], // Load .env.local first, then .env
    }),

    // Logger module - provides global Logger service
    LoggerModule,

    // Database module - provides Prisma Client as a global service
    PrismaModule,

    // Redis module - provides Redis client for caching and BullMQ
    RedisModule,

    // Prometheus module - exposes /metrics endpoint and HTTP metrics middleware
    PrometheusModule,

    // Rate limiting module - provides Redis-backed rate limiting
    RateLimitModule,

    // Events module - provides Outbox pattern for reliable event publishing
    EventsModule,

    // Feature modules
    ProductsModule,
    AuthModule,
    MailerModule, // Email sending infrastructure
    OrdersModule, // Order management
    PaymentsModule, // Payment processing
    InventoryModule, // Inventory management with reservation strategies
    CartModule, // Shopping cart management
    WorkersModule, // Background workers (webhook retry, payment reconciliation)
    SearchModule, // Product search functionality
    RecommendationsModule, // Product recommendations with A/B testing

    // Experiments module - provides experiments feature
    ExperimentsModule,

    // TODO: Add more modules as they are implemented:
    // - ReviewsModule
    // - AnalyticsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  /**
   * Configure global middleware for the application.
   * Middleware order matters: RequestIdMiddleware should run first to add request ID,
   * then PrometheusMiddleware to measure request duration.
   */
  configure(consumer: MiddlewareConsumer) {
    // Apply Request ID middleware to all routes
    consumer.apply(RequestIdMiddleware).forRoutes('*');

    // Apply Prometheus middleware to all routes for metrics collection
    consumer.apply(PrometheusMiddleware).forRoutes('*');
  }
}

