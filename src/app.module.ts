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

// Common modules and utilities
import { LoggerModule } from './lib/logger/logger.module';
import { PrismaModule } from './lib/prisma/prisma.module';
import { RedisModule } from './lib/redis/redis.module';
import { PrometheusModule } from './common/prometheus/prometheus.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { PrometheusMiddleware } from './common/prometheus/prometheus.middleware';

// Experiments module
import { ExperimentsModule } from './modules/experiments/experiments.module';

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

    // Feature modules
    ProductsModule,
    AuthModule,
    MailerModule, // Email sending infrastructure

    // Experiments module - provides experiments feature
    ExperimentsModule,

    // TODO: Add more modules as they are implemented:
    // - InventoryModule
    // - CartModule
    // - CheckoutModule
    // - OrdersModule
    // - ReviewsModule
    // - RecommendationsModule
    // - AnalyticsModule
    // - WorkersModule (BullMQ)
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

