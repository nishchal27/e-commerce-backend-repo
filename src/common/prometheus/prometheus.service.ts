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

  // Webhook retry metrics
  // Counter: Webhook retry attempts
  public readonly webhookRetryAttemptsCounter: PromClient.Counter<string>;
  // Counter: Successful webhook retries
  public readonly webhookRetrySuccessCounter: PromClient.Counter<string>;
  // Counter: Failed webhook retries
  public readonly webhookRetryFailuresCounter: PromClient.Counter<string>;
  // Histogram: Webhook retry latency
  public readonly webhookRetryLatencyHistogram: PromClient.Histogram<string>;

  // Worker metrics
  // Gauge: Active jobs by queue
  public readonly workerActiveJobsGauge: PromClient.Gauge<string>;
  // Gauge: Waiting jobs by queue
  public readonly workerWaitingJobsGauge: PromClient.Gauge<string>;
  // Gauge: Completed jobs by queue
  public readonly workerCompletedJobsGauge: PromClient.Gauge<string>;
  // Gauge: Failed jobs by queue
  public readonly workerFailedJobsGauge: PromClient.Gauge<string>;

  // Search metrics
  // Counter: Total search queries
  public readonly searchQueriesCounter: PromClient.Counter<string>;
  // Histogram: Search query latency
  public readonly searchQueryLatencyHistogram: PromClient.Histogram<string>;
  // Counter: Search errors
  public readonly searchErrorsCounter: PromClient.Counter<string>;
  // Counter: Search indexing operations
  public readonly searchIndexingCounter: PromClient.Counter<string>;
  // Histogram: Search indexing latency
  public readonly searchIndexingLatencyHistogram: PromClient.Histogram<string>;
  // Counter: Search indexing errors
  public readonly searchIndexingErrorsCounter: PromClient.Counter<string>;

  // Recommendation metrics
  // Counter: Total recommendation queries
  public readonly recommendationQueriesCounter: PromClient.Counter<string>;
  // Histogram: Recommendation query latency
  public readonly recommendationQueryLatencyHistogram: PromClient.Histogram<string>;
  // Counter: Recommendation clicks
  public readonly recommendationClicksCounter: PromClient.Counter<string>;
  // Counter: Recommendation errors
  public readonly recommendationErrorsCounter: PromClient.Counter<string>;

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

    // Initialize webhook retry attempts counter
    // Labels: provider
    this.webhookRetryAttemptsCounter = new PromClient.Counter({
      name: 'webhook_retry_attempts_total',
      help: 'Total number of webhook retry attempts',
      labelNames: ['provider'],
      registers: [this.register],
    });

    // Initialize webhook retry success counter
    // Labels: provider
    this.webhookRetrySuccessCounter = new PromClient.Counter({
      name: 'webhook_retry_success_total',
      help: 'Total number of successful webhook retries',
      labelNames: ['provider'],
      registers: [this.register],
    });

    // Initialize webhook retry failures counter
    // Labels: provider, error
    this.webhookRetryFailuresCounter = new PromClient.Counter({
      name: 'webhook_retry_failures_total',
      help: 'Total number of failed webhook retries',
      labelNames: ['provider', 'error'],
      registers: [this.register],
    });

    // Initialize webhook retry latency histogram
    // Labels: provider
    this.webhookRetryLatencyHistogram = new PromClient.Histogram({
      name: 'webhook_retry_latency_seconds',
      help: 'Latency of webhook retry operations in seconds',
      labelNames: ['provider'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register],
    });

    // Initialize worker active jobs gauge
    // Labels: queue
    this.workerActiveJobsGauge = new PromClient.Gauge({
      name: 'worker_active_jobs',
      help: 'Number of active jobs in queue',
      labelNames: ['queue'],
      registers: [this.register],
    });

    // Initialize worker waiting jobs gauge
    // Labels: queue
    this.workerWaitingJobsGauge = new PromClient.Gauge({
      name: 'worker_waiting_jobs',
      help: 'Number of waiting jobs in queue',
      labelNames: ['queue'],
      registers: [this.register],
    });

    // Initialize worker completed jobs gauge
    // Labels: queue
    this.workerCompletedJobsGauge = new PromClient.Gauge({
      name: 'worker_completed_jobs',
      help: 'Number of completed jobs in queue',
      labelNames: ['queue'],
      registers: [this.register],
    });

    // Initialize worker failed jobs gauge
    // Labels: queue
    this.workerFailedJobsGauge = new PromClient.Gauge({
      name: 'worker_failed_jobs',
      help: 'Number of failed jobs in queue',
      labelNames: ['queue'],
      registers: [this.register],
    });

    // Initialize search queries counter
    // Labels: query_length (short, medium, long)
    this.searchQueriesCounter = new PromClient.Counter({
      name: 'search_queries_total',
      help: 'Total number of search queries',
      labelNames: ['query_length'],
      registers: [this.register],
    });

    // Initialize search query latency histogram
    // Labels: query_length
    // Buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5] seconds
    this.searchQueryLatencyHistogram = new PromClient.Histogram({
      name: 'search_query_latency_seconds',
      help: 'Latency of search queries in seconds',
      labelNames: ['query_length'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.register],
    });

    // Initialize search errors counter
    // Labels: error_type
    this.searchErrorsCounter = new PromClient.Counter({
      name: 'search_errors_total',
      help: 'Total number of search errors',
      labelNames: ['error_type'],
      registers: [this.register],
    });

    // Initialize search indexing counter
    // Labels: action (index, delete, reindex)
    this.searchIndexingCounter = new PromClient.Counter({
      name: 'search_indexing_operations_total',
      help: 'Total number of search indexing operations',
      labelNames: ['action'],
      registers: [this.register],
    });

    // Initialize search indexing latency histogram
    // Labels: action
    // Buckets: [0.1, 0.5, 1, 2, 5, 10] seconds
    this.searchIndexingLatencyHistogram = new PromClient.Histogram({
      name: 'search_indexing_latency_seconds',
      help: 'Latency of search indexing operations in seconds',
      labelNames: ['action'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    // Initialize search indexing errors counter
    // Labels: action, error_type
    this.searchIndexingErrorsCounter = new PromClient.Counter({
      name: 'search_indexing_errors_total',
      help: 'Total number of search indexing errors',
      labelNames: ['action', 'error_type'],
      registers: [this.register],
    });

    // Initialize recommendation queries counter
    // Labels: strategy
    this.recommendationQueriesCounter = new PromClient.Counter({
      name: 'recommendation_queries_total',
      help: 'Total number of recommendation queries',
      labelNames: ['strategy'],
      registers: [this.register],
    });

    // Initialize recommendation query latency histogram
    // Labels: strategy
    // Buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5] seconds
    this.recommendationQueryLatencyHistogram = new PromClient.Histogram({
      name: 'recommendation_query_latency_seconds',
      help: 'Latency of recommendation queries in seconds',
      labelNames: ['strategy'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.register],
    });

    // Initialize recommendation clicks counter
    // Labels: strategy
    this.recommendationClicksCounter = new PromClient.Counter({
      name: 'recommendation_clicks_total',
      help: 'Total number of recommendation clicks',
      labelNames: ['strategy'],
      registers: [this.register],
    });

    // Initialize recommendation errors counter
    this.recommendationErrorsCounter = new PromClient.Counter({
      name: 'recommendation_errors_total',
      help: 'Total number of recommendation errors',
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

  /**
   * Record a webhook retry attempt.
   * Called by WebhookRetryProcessor when a webhook retry is attempted.
   *
   * @param provider - Payment provider (stripe, paypal, etc.)
   */
  recordWebhookRetryAttempt(provider: string): void {
    this.webhookRetryAttemptsCounter.inc({
      provider,
    });
  }

  /**
   * Record a successful webhook retry.
   * Called by WebhookRetryProcessor when a webhook retry succeeds.
   *
   * @param provider - Payment provider
   * @param latencySeconds - Retry latency in seconds
   */
  recordWebhookRetrySuccess(provider: string, latencySeconds: number): void {
    this.webhookRetrySuccessCounter.inc({
      provider,
    });

    this.webhookRetryLatencyHistogram.observe({ provider }, latencySeconds);
  }

  /**
   * Record a failed webhook retry.
   * Called by WebhookRetryProcessor when a webhook retry fails.
   *
   * @param provider - Payment provider
   * @param error - Error message
   * @param latencySeconds - Retry latency in seconds
   */
  recordWebhookRetryFailure(provider: string, error: string, latencySeconds: number): void {
    this.webhookRetryFailuresCounter.inc({
      provider,
      error: error.substring(0, 50), // Truncate long error messages
    });

    this.webhookRetryLatencyHistogram.observe({ provider }, latencySeconds);
  }

  /**
   * Update worker queue metrics.
   * Called by worker monitoring service to update queue statistics.
   *
   * @param queue - Queue name
   * @param active - Number of active jobs
   * @param waiting - Number of waiting jobs
   * @param completed - Number of completed jobs
   * @param failed - Number of failed jobs
   */
  updateWorkerMetrics(
    queue: string,
    active: number,
    waiting: number,
    completed: number,
    failed: number,
  ): void {
    this.workerActiveJobsGauge.set({ queue }, active);
    this.workerWaitingJobsGauge.set({ queue }, waiting);
    this.workerCompletedJobsGauge.set({ queue }, completed);
    this.workerFailedJobsGauge.set({ queue }, failed);
  }

  /**
   * Record payment reconciliation.
   * Called by PaymentReconciliationProcessor when reconciling payments.
   *
   * @param paymentId - Payment ID
   * @param reconciled - Whether reconciliation found discrepancies
   * @param latencySeconds - Reconciliation latency in seconds
   */
  recordPaymentReconciliation(
    paymentId: string,
    reconciled: boolean,
    latencySeconds: number,
  ): void {
    // Note: This is a placeholder - you can add specific metrics if needed
    // For now, we'll just log it
  }

  /**
   * Record a search query.
   * Called by SearchService when a search is performed.
   *
   * @param query - Search query string
   * @param resultCount - Number of results returned
   * @param latencySeconds - Search latency in seconds
   */
  recordSearchQuery(query: string, resultCount: number, latencySeconds: number): void {
    const queryLength = query.length < 10 ? 'short' : query.length < 30 ? 'medium' : 'long';
    this.searchQueriesCounter.inc({ query_length: queryLength });
    this.searchQueryLatencyHistogram.observe({ query_length: queryLength }, latencySeconds);
  }

  /**
   * Record a search error.
   * Called by SearchService when a search fails.
   *
   * @param query - Search query string
   * @param latencySeconds - Search latency in seconds
   */
  recordSearchError(query: string, latencySeconds: number): void {
    const queryLength = query.length < 10 ? 'short' : query.length < 30 ? 'medium' : 'long';
    this.searchErrorsCounter.inc({ error_type: 'search_failed' });
    this.searchQueryLatencyHistogram.observe({ query_length: queryLength }, latencySeconds);
  }

  /**
   * Record a search indexing operation.
   * Called by SearchIndexingProcessor when indexing products.
   *
   * @param productId - Product ID
   * @param action - Indexing action (index, delete, reindex)
   * @param latencySeconds - Indexing latency in seconds
   */
  recordSearchIndexing(productId: string, action: string, latencySeconds: number): void {
    this.searchIndexingCounter.inc({ action });
    this.searchIndexingLatencyHistogram.observe({ action }, latencySeconds);
  }

  /**
   * Record a search indexing error.
   * Called by SearchIndexingProcessor when indexing fails.
   *
   * @param productId - Product ID
   * @param action - Indexing action
   * @param latencySeconds - Indexing latency in seconds
   */
  recordSearchIndexingError(productId: string, action: string, latencySeconds: number): void {
    this.searchIndexingErrorsCounter.inc({ action, error_type: 'indexing_failed' });
    this.searchIndexingLatencyHistogram.observe({ action }, latencySeconds);
  }

  /**
   * Record a recommendation query.
   * Called by RecommendationsService when generating recommendations.
   *
   * @param strategy - Recommendation strategy used
   * @param resultCount - Number of recommendations returned
   * @param latencySeconds - Query latency in seconds
   */
  recordRecommendationQuery(strategy: string, resultCount: number, latencySeconds: number): void {
    this.recommendationQueriesCounter.inc({ strategy });
    this.recommendationQueryLatencyHistogram.observe({ strategy }, latencySeconds);
  }

  /**
   * Record a recommendation click.
   * Called by RecommendationsService when a user clicks a recommendation.
   *
   * @param strategy - Recommendation strategy that generated the clicked recommendation
   */
  recordRecommendationClick(strategy: string): void {
    this.recommendationClicksCounter.inc({ strategy });
  }

  /**
   * Record a recommendation error.
   * Called by RecommendationsService when recommendation generation fails.
   *
   * @param latencySeconds - Query latency in seconds
   */
  recordRecommendationError(latencySeconds: number): void {
    this.recommendationErrorsCounter.inc();
    // Note: We don't have strategy context on error, so we can't label it
  }
}

