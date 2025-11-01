/**
 * Prometheus Controller
 *
 * This controller exposes the /metrics endpoint that Prometheus scrapes to collect metrics.
 * The endpoint returns metrics in Prometheus exposition format (text-based format).
 *
 * Usage:
 * - Prometheus server scrapes this endpoint periodically (e.g., every 15 seconds)
 * - Metrics can also be viewed manually by visiting http://localhost:3000/metrics
 * - Grafana can query Prometheus to visualize these metrics in dashboards
 */

import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrometheusService } from './prometheus.service';

/**
 * PrometheusController handles the /metrics endpoint for metrics collection.
 */
@Controller()
export class PrometheusController {
  constructor(private readonly prometheusService: PrometheusService) {}

  /**
   * GET /metrics
   * Returns Prometheus metrics in text format for scraping by Prometheus server.
   * Sets Content-Type header to 'text/plain; version=0.0.4' as per Prometheus specification.
   */
  @Get('metrics')
  async getMetrics(@Res() res: Response): Promise<void> {
    const register = this.prometheusService.getRegister();
    const metrics = await register.metrics();

    // Set content type header as required by Prometheus
    res.setHeader('Content-Type', register.contentType);
    res.send(metrics);
  }
}

