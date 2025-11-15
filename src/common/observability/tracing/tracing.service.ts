/**
 * Tracing Service
 *
 * This service provides OpenTelemetry distributed tracing functionality.
 * It initializes the OpenTelemetry SDK and configures instrumentation for HTTP and database operations.
 *
 * Responsibilities:
 * - Initialize OpenTelemetry SDK
 * - Configure trace exporters (Jaeger, Prometheus)
 * - Set up automatic instrumentation for HTTP and database
 * - Provide trace context propagation
 * - Generate and manage trace IDs
 *
 * How It Works:
 * 1. SDK is initialized on application startup
 * 2. HTTP instrumentation automatically creates spans for incoming requests
 * 3. Database instrumentation creates spans for Prisma queries
 * 4. Trace context is propagated via headers (traceparent, tracestate)
 * 5. Traces are exported to Jaeger (or configured backend)
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { trace, context, Span, SpanStatusCode } from '@opentelemetry/api';
import { Logger } from '../../../lib/logger';

/**
 * TracingService manages OpenTelemetry distributed tracing
 */
@Injectable()
export class TracingService implements OnModuleInit, OnModuleDestroy {
  private sdk: NodeSDK | null = null;
  private readonly enabled: boolean;
  private readonly serviceName: string;
  private readonly jaegerEndpoint?: string;
  private readonly samplingRate: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.enabled = this.configService.get<boolean>('OTEL_ENABLED', true);
    this.serviceName = this.configService.get<string>(
      'OTEL_SERVICE_NAME',
      'e-commerce-backend',
    );
    this.jaegerEndpoint = this.configService.get<string>('OTEL_EXPORTER_JAEGER_ENDPOINT');
    this.samplingRate = this.configService.get<number>('OTEL_SAMPLING_RATE', 1.0); // 100% in dev, 1-5% in prod
  }

  /**
   * Initialize OpenTelemetry SDK on module init
   */
  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log('OpenTelemetry tracing is disabled', 'TracingService');
      return;
    }

    try {
      // Create resource with service information
      const resource = resourceFromAttributes({
        [SEMRESATTRS_SERVICE_NAME]: this.serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
      });

      // Configure Jaeger exporter if endpoint is provided
      const jaegerExporter = this.jaegerEndpoint
        ? new JaegerExporter({
            endpoint: this.jaegerEndpoint,
          })
        : undefined;

      this.sdk = new NodeSDK({
        resource,
        traceExporter: jaegerExporter,
        instrumentations: [
          new HttpInstrumentation(),
          new ExpressInstrumentation(),
          new PgInstrumentation({
            // Instrument Prisma database queries
            enhancedDatabaseReporting: true,
          }),
        ],
        // Sampling configuration
        sampler: {
          shouldSample: () => {
            // Simple sampling based on rate
            return Math.random() < this.samplingRate
              ? { decision: 1 } // RECORD_AND_SAMPLE
              : { decision: 0 }; // NOT_RECORD
          },
        },
      });

      // Start the SDK
      await this.sdk.start();

      this.logger.log(
        `OpenTelemetry tracing initialized: service=${this.serviceName}, sampling=${this.samplingRate * 100}%`,
        'TracingService',
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to initialize OpenTelemetry: ${error.message}`,
        error.stack,
        'TracingService',
      );
    }
  }

  /**
   * Shutdown OpenTelemetry SDK on module destroy
   */
  async onModuleDestroy() {
    if (this.sdk) {
      await this.sdk.shutdown();
      this.logger.log('OpenTelemetry tracing shutdown', 'TracingService');
    }
  }

  /**
   * Get current trace ID from active span
   *
   * @returns Trace ID in W3C format or undefined if no active span
   */
  getCurrentTraceId(): string | undefined {
    const activeSpan = trace.getActiveSpan();
    if (!activeSpan) {
      return undefined;
    }

    const spanContext = activeSpan.spanContext();
    return spanContext.traceId
      ? `${spanContext.traceId.slice(0, 2)}-${spanContext.traceId.slice(2, 18)}-${spanContext.traceId.slice(18, 34)}-${spanContext.traceId.slice(34, 50)}`
      : undefined;
  }

  /**
   * Get current span ID from active span
   *
   * @returns Span ID or undefined if no active span
   */
  getCurrentSpanId(): string | undefined {
    const activeSpan = trace.getActiveSpan();
    return activeSpan?.spanContext().spanId;
  }

  /**
   * Create a new span for a custom operation
   *
   * @param name - Span name
   * @param fn - Function to execute within the span
   * @returns Result of the function
   */
  async createSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
    const tracer = trace.getTracer(this.serviceName);
    return tracer.startActiveSpan(name, async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error: any) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Add attributes to the current active span
   *
   * @param attributes - Key-value pairs of attributes
   */
  setSpanAttributes(attributes: Record<string, string | number | boolean>): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      Object.entries(attributes).forEach(([key, value]) => {
        activeSpan.setAttribute(key, value);
      });
    }
  }

  /**
   * Add an event to the current active span
   *
   * @param name - Event name
   * @param attributes - Optional event attributes
   */
  addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.addEvent(name, attributes);
    }
  }
}

