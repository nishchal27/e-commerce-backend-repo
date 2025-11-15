/**
 * Prometheus Service
 *
 * This service wraps the prom-client library to provide Prometheus metrics collection.
 * It registers and manages custom metrics that can be exported via the /metrics endpoint.
 *
 * Metrics provided:
 * - Counter: HTTP request counts (http_requests_total)
 * - Histogram: HTTP request duration (http_request_duration_seconds)
 * - Gauge: Process memory usage (process_resident_memory_bytes)
 * - Gauge: Process CPU usage (process_cpu_seconds_total)
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as PromClient from 'prom-client';

/**
 * PrometheusService manages Prometheus metrics registration and collection.
 */
@Injectable()
export class PrometheusService {
  // Register default Prometheus metrics (CPU, memory, event loop lag, etc.)
  private readonly register: PromClient.Registry;

  // Counter metric: Total number of HTTP requests
  // Labels: route (e.g., /products/:id), method (GET, POST, etc.), status (200, 404, etc.)
  public readonly httpRequestCounter: PromClient.Counter<string>;

  // Histogram metric: Duration of HTTP requests in seconds
  // Labels: route, method, status
  // Buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] seconds
  public readonly httpRequestDuration: PromClient.Histogram<string>;

  // Gauge metric: Process resident memory in bytes
  public readonly processMemoryGauge: PromClient.Gauge<string>;

  // Gauge metric: Process CPU time in seconds
  public readonly processCpuGauge: PromClient.Gauge<string>;

  // Auth-specific metrics
  // Counter: Total login attempts (successful and failed)
  public readonly authLoginAttemptsCounter: PromClient.Counter<string>;
  // Counter: Failed login attempts
  public readonly authLoginFailuresCounter: PromClient.Counter<string>;
  // Counter: Token refresh operations
  public readonly authTokenRefreshesCounter: PromClient.Counter<string>;
  // Counter: User registrations
  public readonly authRegistrationsCounter: PromClient.Counter<string>;
  // Counter: Rate limit blocks
  public readonly rateLimitBlocksCounter: PromClient.Counter<string>;

  // Inventory reservation strategy metrics
  // Counter: Total reservation attempts by strategy
  public readonly inventoryReservationAttemptsCounter: PromClient.Counter<string>;
  // Counter: Successful reservations by strategy
  public readonly inventoryReservationSuccessCounter: PromClient.Counter<string>;
  // Counter: Failed reservations by strategy and reason
  public readonly inventoryReservationFailuresCounter: PromClient.Counter<string>;
  // Histogram: Reservation latency by strategy
  public readonly inventoryReservationLatencyHistogram: PromClient.Histogram<string>;
  // Counter: Reservation commits by strategy
  public readonly inventoryReservationCommitsCounter: PromClient.Counter<string>;
  // Counter: Reservation releases by strategy
  public readonly inventoryReservationReleasesCounter: PromClient.Counter<string>;

  constructor(private readonly configService: ConfigService) {
    // Create a new registry to hold all metrics
    this.register = new PromClient.Registry();

    // Collect default metrics (CPU, memory, event loop, etc.)
    PromClient.collectDefaultMetrics({
      register: this.register,
      prefix: 'app_', // Prefix all default metrics with 'app_'
    });

    // Initialize HTTP request counter
    this.httpRequestCounter = new PromClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['route', 'method', 'status'],
      registers: [this.register],
    });

    // Initialize HTTP request duration histogram
    this.httpRequestDuration = new PromClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['route', 'method', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], // Response time buckets
      registers: [this.register],
    });

    // Initialize process memory gauge
    this.processMemoryGauge = new PromClient.Gauge({
      name: 'process_resident_memory_bytes',
      help: 'Process resident memory size in bytes',
      registers: [this.register],
    });

    // Initialize process CPU gauge
    this.processCpuGauge = new PromClient.Gauge({
      name: 'process_cpu_seconds_total',
      help: 'Total user and system CPU time spent in seconds',
      registers: [this.register],
    });

    // Initialize auth login attempts counter
    // Labels: status (success, failure)
    this.authLoginAttemptsCounter = new PromClient.Counter({
      name: 'auth_login_attempts_total',
      help: 'Total number of login attempts',
      labelNames: ['status'], // 'success' or 'failure'
      registers: [this.register],
    });

    // Initialize auth login failures counter
    // Labels: reason (invalid_credentials, user_not_found, etc.)
    this.authLoginFailuresCounter = new PromClient.Counter({
      name: 'auth_login_failures_total',
      help: 'Total number of failed login attempts',
      labelNames: ['reason'], // Reason for failure (e.g., 'invalid_credentials', 'user_not_found')
      registers: [this.register],
    });

    // Initialize auth token refreshes counter
    // Labels: status (success, failure)
    this.authTokenRefreshesCounter = new PromClient.Counter({
      name: 'auth_token_refreshes_total',
      help: 'Total number of token refresh operations',
      labelNames: ['status'], // 'success' or 'failure'
      registers: [this.register],
    });

    // Initialize auth registrations counter
    // Labels: status (success, failure)
    this.authRegistrationsCounter = new PromClient.Counter({
      name: 'auth_registrations_total',
      help: 'Total number of user registrations',
      labelNames: ['status'], // 'success' or 'failure'
      registers: [this.register],
    });

    // Initialize rate limit blocks counter
    // Labels: endpoint (e.g., '/auth/login'), type (e.g., 'login')
    this.rateLimitBlocksCounter = new PromClient.Counter({
      name: 'rate_limit_blocks_total',
      help: 'Total number of requests blocked by rate limiting',
      labelNames: ['endpoint', 'type'], // Endpoint path and rate limit type
      registers: [this.register],
    });

    // Initialize inventory reservation attempts counter
    // Labels: strategy (optimistic, pessimistic)
    this.inventoryReservationAttemptsCounter = new PromClient.Counter({
      name: 'inventory_reservation_attempts_total',
      help: 'Total number of inventory reservation attempts',
      labelNames: ['strategy'], // Reservation strategy (optimistic, pessimistic)
      registers: [this.register],
    });

    // Initialize inventory reservation success counter
    // Labels: strategy
    this.inventoryReservationSuccessCounter = new PromClient.Counter({
      name: 'inventory_reservation_success_total',
      help: 'Total number of successful inventory reservations',
      labelNames: ['strategy'],
      registers: [this.register],
    });

    // Initialize inventory reservation failures counter
    // Labels: strategy, reason (insufficient_stock, not_found, etc.)
    this.inventoryReservationFailuresCounter = new PromClient.Counter({
      name: 'inventory_reservation_failures_total',
      help: 'Total number of failed inventory reservations',
      labelNames: ['strategy', 'reason'],
      registers: [this.register],
    });

    // Initialize inventory reservation latency histogram
    // Labels: strategy
    // Buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5] seconds
    this.inventoryReservationLatencyHistogram = new PromClient.Histogram({
      name: 'inventory_reservation_latency_seconds',
      help: 'Latency of inventory reservation operations in seconds',
      labelNames: ['strategy'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.register],
    });

    // Initialize inventory reservation commits counter
    // Labels: strategy
    this.inventoryReservationCommitsCounter = new PromClient.Counter({
      name: 'inventory_reservation_commits_total',
      help: 'Total number of inventory reservation commits',
      labelNames: ['strategy'],
      registers: [this.register],
    });

    // Initialize inventory reservation releases counter
    // Labels: strategy
    this.inventoryReservationReleasesCounter = new PromClient.Counter({
      name: 'inventory_reservation_releases_total',
      help: 'Total number of inventory reservation releases',
      labelNames: ['strategy'],
      registers: [this.register],
    });

    // Start periodic collection of process metrics
    this.startProcessMetricsCollection();
  }

  /**
   * Get the Prometheus metrics registry.
   * Used by the controller to export metrics in Prometheus format.
   */
  getRegister(): PromClient.Registry {
    return this.register;
  }

  /**
   * Record an HTTP request metric.
   * Called by the Prometheus middleware for every HTTP request.
   *
   * @param route - The route path (e.g., '/products/:id')
   * @param method - The HTTP method (GET, POST, etc.)
   * @param status - The HTTP status code (200, 404, 500, etc.)
   * @param duration - Request duration in seconds
   */
  recordHttpRequest(
    route: string,
    method: string,
    status: number,
    duration: number,
  ): void {
    // Increment request counter
    this.httpRequestCounter.inc({
      route,
      method,
      status: status.toString(),
    });

    // Record request duration
    this.httpRequestDuration.observe(
      {
        route,
        method,
        status: status.toString(),
      },
      duration,
    );
  }

  /**
   * Start periodic collection of process metrics (memory, CPU).
   * Updates gauges every 5 seconds with current process stats.
   */
  private startProcessMetricsCollection(): void {
    setInterval(() => {
      const usage = process.cpuUsage();
      const memUsage = process.memoryUsage();

      // Update CPU time gauge (convert microseconds to seconds)
      const cpuSeconds =
        (usage.user + usage.system) / 1_000_000; // Convert microseconds to seconds
      this.processCpuGauge.set(cpuSeconds);

      // Update memory gauge (resident set size in bytes)
      this.processMemoryGauge.set(memUsage.rss);
    }, 5000); // Update every 5 seconds
  }

  /**
   * Record a login attempt.
   * Called by AuthService when a login attempt is made.
   *
   * @param success - Whether the login was successful
   * @param reason - Reason for failure (if unsuccessful)
   */
  recordLoginAttempt(success: boolean, reason?: string): void {
    // Increment login attempts counter
    this.authLoginAttemptsCounter.inc({
      status: success ? 'success' : 'failure',
    });

    // If failed, increment failures counter with reason
    if (!success) {
      this.authLoginFailuresCounter.inc({
        reason: reason || 'unknown',
      });
    }
  }

  /**
   * Record a token refresh operation.
   * Called by AuthService when a token refresh is attempted.
   *
   * @param success - Whether the refresh was successful
   */
  recordTokenRefresh(success: boolean): void {
    this.authTokenRefreshesCounter.inc({
      status: success ? 'success' : 'failure',
    });
  }

  /**
   * Record a user registration.
   * Called by AuthService when a user registers.
   *
   * @param success - Whether the registration was successful
   */
  recordRegistration(success: boolean): void {
    this.authRegistrationsCounter.inc({
      status: success ? 'success' : 'failure',
    });
  }

  /**
   * Record a rate limit block.
   * Called by RateLimitGuard when a request is blocked due to rate limiting.
   *
   * @param endpoint - The endpoint path (e.g., '/auth/login')
   * @param type - The rate limit type (e.g., 'login', 'register')
   */
  recordRateLimitBlock(endpoint: string, type: string): void {
    this.rateLimitBlocksCounter.inc({
      endpoint,
      type,
    });
  }

  /**
   * Record an inventory reservation attempt.
   * Called by InventoryService when a reservation is attempted.
   *
   * @param strategy - Reservation strategy (optimistic, pessimistic)
   */
  recordInventoryReservationAttempt(strategy: string): void {
    this.inventoryReservationAttemptsCounter.inc({
      strategy,
    });
  }

  /**
   * Record a successful inventory reservation.
   * Called by InventoryService when a reservation succeeds.
   *
   * @param strategy - Reservation strategy
   * @param latencySeconds - Reservation latency in seconds
   */
  recordInventoryReservationSuccess(
    strategy: string,
    latencySeconds: number,
  ): void {
    this.inventoryReservationSuccessCounter.inc({
      strategy,
    });

    this.inventoryReservationLatencyHistogram.observe(
      { strategy },
      latencySeconds,
    );
  }

  /**
   * Record a failed inventory reservation.
   * Called by InventoryService when a reservation fails.
   *
   * @param strategy - Reservation strategy
   * @param reason - Failure reason (insufficient_stock, not_found, etc.)
   * @param latencySeconds - Reservation latency in seconds
   */
  recordInventoryReservationFailure(
    strategy: string,
    reason: string,
    latencySeconds: number,
  ): void {
    this.inventoryReservationFailuresCounter.inc({
      strategy,
      reason,
    });

    this.inventoryReservationLatencyHistogram.observe(
      { strategy },
      latencySeconds,
    );
  }

  /**
   * Record an inventory reservation commit.
   * Called by InventoryService when a reservation is committed.
   *
   * @param strategy - Reservation strategy
   */
  recordInventoryReservationCommit(strategy: string): void {
    this.inventoryReservationCommitsCounter.inc({
      strategy,
    });
  }

  /**
   * Record an inventory reservation release.
   * Called by InventoryService when a reservation is released.
   *
   * @param strategy - Reservation strategy
   */
  recordInventoryReservationRelease(strategy: string): void {
    this.inventoryReservationReleasesCounter.inc({
      strategy,
    });
  }
}

