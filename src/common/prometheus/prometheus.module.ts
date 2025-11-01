/**
 * Prometheus Module
 *
 * This module provides Prometheus metrics collection and exposes a /metrics endpoint.
 *
 * Metrics collected:
 * - HTTP request counts by route, method, and status code
 * - HTTP request duration (histogram)
 * - Process CPU and memory usage
 * - Database query duration (when implemented)
 * - Cache hits/misses (when implemented)
 * - BullMQ job metrics (when implemented)
 *
 * The /metrics endpoint can be scraped by Prometheus for monitoring and alerting.
 */

import { Module, Global } from '@nestjs/common';
import { PrometheusController } from './prometheus.controller';
import { PrometheusService } from './prometheus.service';
import { PrometheusMiddleware } from './prometheus.middleware';

/**
 * Global Prometheus module that provides metrics collection throughout the application.
 * Marked as Global so it doesn't need to be imported in every module.
 */
@Global()
@Module({
  controllers: [PrometheusController],
  providers: [PrometheusService, PrometheusMiddleware],
  exports: [PrometheusService, PrometheusMiddleware],
})
export class PrometheusModule {}

