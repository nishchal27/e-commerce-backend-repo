/**
 * Request ID Middleware
 *
 * This middleware adds a unique request ID to every incoming HTTP request.
 * The request ID is:
 * - Generated if not present in headers (X-Request-ID)
 * - Added to response headers
 * - Stored in request object for use in logs and tracing
 * - Used to correlate logs across services in distributed systems
 *
 * Benefits:
 * - Trace requests through the entire request lifecycle
 * - Correlate logs from multiple services for a single user request
 * - Debug production issues by searching logs by request ID
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request interface extension to include requestId and traceId properties.
 * This allows TypeScript to recognize these properties on the request object.
 */
export interface RequestWithId extends Request {
  requestId: string;
  traceId?: string; // Optional: OpenTelemetry trace ID (if available)
}

/**
 * RequestIdMiddleware generates and attaches a unique request ID to each HTTP request.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  /**
   * Middleware handler that:
   * 1. Checks for existing X-Request-ID header (useful for microservices)
   * 2. Generates a new UUID if not present
   * 3. Attaches it to the request object
   * 4. Adds it to response headers for client-side correlation
   */
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    // Check if request ID is already present in headers (from upstream service)
    const requestId = req.headers['x-request-id'] || uuidv4();

    // Attach request ID to request object for use in controllers/services
    req.requestId = Array.isArray(requestId) ? requestId[0] : requestId;

    // Extract trace ID from headers if present (OpenTelemetry traceparent format)
    // Format: traceparent: 00-{trace-id}-{parent-id}-{flags}
    const traceparent = req.headers['traceparent'] as string | undefined;
    if (traceparent) {
      const parts = traceparent.split('-');
      if (parts.length >= 2) {
        req.traceId = `${parts[1].slice(0, 2)}-${parts[1].slice(2, 18)}-${parts[1].slice(18, 34)}-${parts[1].slice(34, 50)}`;
      }
    }

    // Add request ID to response headers so clients can use it for correlation
    res.setHeader('X-Request-ID', req.requestId);
    if (req.traceId) {
      res.setHeader('X-Trace-ID', req.traceId);
    }

    // Continue to next middleware/handler
    next();
  }
}

