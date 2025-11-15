/**
 * Observability Module
 *
 * This module provides comprehensive observability functionality:
 * - OpenTelemetry distributed tracing
 * - Enhanced health checks
 * - Log correlation
 * - Metrics aggregation
 *
 * Responsibilities:
 * - Initialize OpenTelemetry SDK
 * - Provide health check endpoints
 * - Integrate tracing with HTTP requests
 * - Export observability data
 */

import { Module, Global } from '@nestjs/common';
import { TracingModule } from './tracing/tracing.module';
import { HealthService } from './health/health.service';
import { HealthController } from './health/health.controller';
import { TracingMiddleware } from './middleware/tracing.middleware';
import { OutboxMetricsService } from './services/outbox-metrics.service';
import { PrismaModule } from '../../lib/prisma/prisma.module';
import { RedisModule } from '../../lib/redis/redis.module';
import { WorkersModule } from '../workers/workers.module';
import { PrometheusModule } from '../prometheus/prometheus.module';
import { LoggerModule } from '../../lib/logger/logger.module';

@Global() // Make observability services available globally
@Module({
  imports: [
    TracingModule,
    PrismaModule,
    RedisModule,
    WorkersModule, // For queue health checks
    PrometheusModule, // For metrics
    LoggerModule,
  ],
  controllers: [HealthController],
  providers: [HealthService, TracingMiddleware, OutboxMetricsService],
  exports: [TracingModule, HealthService, TracingMiddleware],
})
export class ObservabilityModule {}

