/**
 * Domain Event Interface
 *
 * This file defines the structure for domain events in the event-driven architecture.
 * All domain events must follow this consistent envelope to make analytics and tracing trivial.
 *
 * Purpose:
 * - Standardize event structure across all modules
 * - Enable event correlation via trace_id and request_id
 * - Support event versioning (v1, v2, etc.)
 * - Include metadata for feature flags and environment context
 */

/**
 * Domain Event Envelope
 *
 * This interface defines the standard structure for all domain events.
 * Events are stored in the Outbox table and published to event bus (Redis Stream/Kafka).
 *
 * Example:
 * {
 *   event_id: "550e8400-e29b-41d4-a716-446655440000",
 *   event_type: "order.created.v1",
 *   timestamp: "2025-11-12T10:00:00.000Z",
 *   source: "orders-service",
 *   trace_id: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
 *   request_id: "req-123",
 *   payload: { order_id: "order-456", user_id: "user-789", ... },
 *   meta: { env: "production", version: "1.2.0", feature_flags: ["inventory.optimistic"] }
 * }
 */
export interface DomainEvent {
  /**
   * Unique event identifier (UUID v4)
   * Used for deduplication and event tracking
   */
  event_id: string;

  /**
   * Event type with version (e.g., "order.created.v1")
   * Format: {domain}.{action}.v{version}
   * Versioning allows schema evolution without breaking consumers
   */
  event_type: string;

  /**
   * Event timestamp in ISO 8601 format
   * When the event occurred (not when it was published)
   */
  timestamp: string;

  /**
   * Source service/module that emitted the event
   * Examples: "orders-service", "payments-service", "inventory-service"
   */
  source: string;

  /**
   * OpenTelemetry trace ID (optional)
   * Enables distributed tracing across services
   */
  trace_id?: string;

  /**
   * Request ID from middleware (optional)
   * Correlates events with the original HTTP request
   */
  request_id?: string;

  /**
   * Domain-specific event payload
   * Structure depends on event_type
   * Example for order.created: { order_id, user_id, total_amount, items, ... }
   */
  payload: Record<string, any>;

  /**
   * Metadata about the event
   * Includes environment, version, feature flags for context
   */
  meta?: {
    env?: string; // Environment: "development", "staging", "production"
    version?: string; // Service version: "orders@1.2.0"
    feature_flags?: string[]; // Active feature flags: ["inventory.optimistic"]
  };
}

/**
 * Event Metadata
 *
 * Additional context for events (environment, version, feature flags)
 */
export interface EventMetadata {
  env?: string;
  version?: string;
  feature_flags?: string[];
}

