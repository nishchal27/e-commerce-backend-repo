/**
 * Tracing Middleware
 *
 * This middleware integrates OpenTelemetry tracing with HTTP requests.
 * It extracts trace context from headers and sets up request tracing.
 *
 * Responsibilities:
 * - Extract trace context from incoming headers (traceparent, tracestate)
 * - Set trace ID in request object for correlation
 * - Add trace ID to response headers
 * - Create spans for request processing
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { trace, context, propagation } from '@opentelemetry/api';
import { TracingService } from '../tracing/tracing.service';
import { RequestWithId } from '../../middleware/request-id.middleware';

/**
 * TracingMiddleware integrates OpenTelemetry with HTTP requests
 */
@Injectable()
export class TracingMiddleware implements NestMiddleware {
  constructor(private readonly tracingService: TracingService) {}

  /**
   * Middleware handler that:
   * 1. Extracts trace context from headers
   * 2. Sets up trace context for the request
   * 3. Adds trace ID to request object
   * 4. Adds trace ID to response headers
   */
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    // Extract trace context from headers (W3C Trace Context format)
    const parentContext = propagation.extract(context.active(), req.headers);

    // Run the request handler within the trace context
    context.with(parentContext, () => {
      // Get trace ID and add to request object
      const traceId = this.tracingService.getCurrentTraceId();
      if (traceId) {
        req.traceId = traceId;
        // Add trace ID to response headers for client correlation
        res.setHeader('X-Trace-ID', traceId);
      }

      // Add request attributes to span
      this.tracingService.setSpanAttributes({
        'http.request.method': req.method,
        'http.request.url': req.url || '',
        'http.request.path': req.path || '',
        'http.request.route': (req.route?.path as string) || '',
        'http.request.id': req.requestId || '',
      });

      // Continue to next middleware
      next();
    });
  }
}

