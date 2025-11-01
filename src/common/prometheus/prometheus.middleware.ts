/**
 * Prometheus Middleware
 *
 * This middleware measures HTTP request duration and records metrics for every request.
 * It integrates with the PrometheusService to automatically collect:
 * - Request count per route/method/status
 * - Request duration histogram per route/method/status
 *
 * The middleware uses high-resolution time (process.hrtime) for accurate duration measurement.
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrometheusService } from './prometheus.service';

/**
 * Extended request interface to store the start time for duration calculation.
 */
interface RequestWithTiming extends Request {
  startTime?: [number, number]; // [seconds, nanoseconds] from process.hrtime()
}

/**
 * PrometheusMiddleware measures and records HTTP request metrics.
 */
@Injectable()
export class PrometheusMiddleware implements NestMiddleware {
  constructor(private readonly prometheusService: PrometheusService) {}

  /**
   * Middleware handler that:
   * 1. Records request start time
   * 2. Waits for response to finish
   * 3. Calculates request duration
   * 4. Records metrics (count + duration) to Prometheus
   */
  use(req: RequestWithTiming, res: Response, next: NextFunction): void {
    // Record start time using high-resolution time for accurate measurement
    req.startTime = process.hrtime();

    // Listen for response finish event to record metrics
    res.on('finish', () => {
      if (req.startTime) {
        // Calculate duration in seconds
        const duration = process.hrtime(req.startTime);
        const durationSeconds = duration[0] + duration[1] / 1e9;

        // Get route path (fallback to req.path if route is not set)
        const route = req.route?.path || req.path || 'unknown';

        // Get HTTP method
        const method = req.method;

        // Get HTTP status code
        const status = res.statusCode;

        // Record metrics in Prometheus
        this.prometheusService.recordHttpRequest(route, method, status, durationSeconds);
      }
    });

    // Continue to next middleware/handler
    next();
  }
}

