/**
 * Inventory Service
 *
 * This service contains the business logic for inventory operations.
 * It coordinates between reservation strategies, product variants, and reservations.
 *
 * Responsibilities:
 * - Inventory reservation (reserve, commit, release)
 * - Strategy selection (optimistic vs pessimistic)
 * - Stock management
 * - Integration with experiments (A/B testing strategies)
 * - Event emission via Outbox pattern
 *
 * Key Features:
 * - Strategy pattern for reservation algorithms
 * - Experiment integration (A/B test strategies)
 * - Event emission (inventory.reserved, inventory.committed, inventory.released)
 * - Error handling and logging
 */

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { OutboxService } from '../../common/events/outbox.service';
import { PrometheusService } from '../../common/prometheus/prometheus.service';
import { ExperimentsService } from '../experiments/experiments.service';
import { IReservationStrategy } from './interfaces/reservation-strategy.interface';
import { OptimisticStrategy } from './strategies/optimistic.strategy';
import { PessimisticStrategy } from './strategies/pessimistic.strategy';
import { ReserveInventoryDto } from './dto/reserve-inventory.dto';
import { CommitReservationDto } from './dto/commit-reservation.dto';
import { ReleaseReservationDto } from './dto/release-reservation.dto';
import { ConfigService } from '@nestjs/config';
import { Logger } from '../../lib/logger';

/**
 * InventoryService handles business logic for inventory operations
 */
@Injectable()
export class InventoryService {
  private readonly defaultStrategy: IReservationStrategy;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly prometheusService: PrometheusService,
    private readonly experimentsService: ExperimentsService,
    private readonly optimisticStrategy: OptimisticStrategy,
    private readonly pessimisticStrategy: PessimisticStrategy,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    // Select default strategy based on configuration
    // Can be overridden via experiments/feature flags
    const strategyName = this.configService.get<string>(
      'INVENTORY_RESERVATION_STRATEGY',
      'optimistic',
    );

    this.defaultStrategy =
      strategyName === 'pessimistic' ? this.pessimisticStrategy : this.optimisticStrategy;

    this.logger.log(
      `InventoryService initialized with strategy: ${this.defaultStrategy.name}`,
      'InventoryService',
    );
  }

  /**
   * Get reservation strategy.
   *
   * This method selects the reservation strategy based on:
   * 1. Experiment assignment (A/B testing via ExperimentsService)
   * 2. Configuration (default fallback)
   *
   * Experiment Integration:
   * - Uses ExperimentsService to assign variant deterministically
   * - Same user/session always gets same variant (deterministic)
   * - Supports sampling (control experiment participation)
   *
   * @param userId - Optional user ID for experiment assignment
   * @param sessionId - Optional session ID for anonymous users
   * @returns Reservation strategy and variant info
   */
  private getStrategy(
    userId?: string,
    sessionId?: string,
  ): { strategy: IReservationStrategy; variant: string; inExperiment: boolean } {
    // Get experiment assignment
    const subjectId = userId || sessionId || 'anonymous';
    const subjectType = userId ? 'user' : 'session';
    const assignment = this.experimentsService.assignVariant(
      'inventory.reservation_strategy',
      subjectId,
      subjectType,
    );

    // If in experiment, use assigned variant
    if (assignment.inExperiment) {
      const strategy =
        assignment.variant === 'pessimistic'
          ? this.pessimisticStrategy
          : this.optimisticStrategy;

      return {
        strategy,
        variant: assignment.variant,
        inExperiment: true,
      };
    }

    // Not in experiment, use default strategy
    return {
      strategy: this.defaultStrategy,
      variant: this.defaultStrategy.name,
      inExperiment: false,
    };
  }

  /**
   * Reserve inventory.
   *
   * This method:
   * 1. Selects reservation strategy via experiment assignment (A/B testing)
   * 2. Records attempt metric
   * 3. Measures latency
   * 4. Reserves inventory using selected strategy
   * 5. Records success/failure metrics and conversion
   * 6. Emits inventory.reserved event
   *
   * Metrics Tracked:
   * - Attempts (by strategy)
   * - Success/Failure (by strategy and reason)
   * - Latency (histogram by strategy)
   * - Experiment conversions (success/failure outcomes)
   *
   * @param reserveDto - Reservation data
   * @param userId - Optional user ID (for experiment assignment)
   * @param sessionId - Optional session ID (for anonymous users)
   * @param requestId - Optional request ID for event correlation
   * @param traceId - Optional trace ID for distributed tracing
   * @returns Reservation result
   */
  async reserve(
    reserveDto: ReserveInventoryDto,
    userId?: string,
    sessionId?: string,
    requestId?: string,
    traceId?: string,
  ) {
    const { skuId, quantity, reservedBy, ttlSeconds } = reserveDto;
    const startTime = Date.now();

    // Get strategy via experiment assignment
    const { strategy, variant, inExperiment } = this.getStrategy(userId, sessionId);
    const subjectId = userId || sessionId || reservedBy;

    // Record attempt metric
    this.prometheusService.recordInventoryReservationAttempt(variant);

    try {
      // Reserve inventory
      const result = await strategy.reserve({
          skuId,
          quantity,
          reservedBy,
          ttlSeconds,
        });

        const latencySeconds = (Date.now() - startTime) / 1000;

        if (!result.success) {
          // Record failure metric
          const reason = this.extractFailureReason(result.error || 'unknown');
          this.prometheusService.recordInventoryReservationFailure(
            variant,
            reason,
            latencySeconds,
          );

          // Record experiment conversion (failure)
          if (inExperiment) {
            await this.experimentsService.recordConversion(
              'inventory.reservation_strategy',
              subjectId,
              variant,
              'reservation_failure',
              {
                sku_id: skuId,
                quantity,
                reason,
                latency_seconds: latencySeconds,
                error: result.error,
              },
            );
          }

          throw new BadRequestException(result.error || 'Failed to reserve inventory');
        }

        // Record success metric
        this.prometheusService.recordInventoryReservationSuccess(
          variant,
          latencySeconds,
        );

        // Record experiment conversion (success)
        if (inExperiment) {
          await this.experimentsService.recordConversion(
            'inventory.reservation_strategy',
            subjectId,
            variant,
            'reservation_success',
            {
              reservation_id: result.reservationId,
              sku_id: skuId,
              quantity,
              available_stock: result.availableStock,
              latency_seconds: latencySeconds,
            },
          );
        }

        // Emit inventory.reserved event
        await this.outboxService.writeEvent({
          topic: 'inventory.reserved',
          event: this.outboxService.createEvent(
            'inventory.reserved.v1',
            {
              reservation_id: result.reservationId,
              sku_id: skuId,
              quantity,
              reserved_by: reservedBy,
              strategy: variant,
              in_experiment: inExperiment,
              available_stock: result.availableStock,
              latency_seconds: latencySeconds,
            },
            {
              trace_id: traceId,
              request_id: requestId,
            },
          ),
        });

        this.logger.log(
          `Inventory reserved: ${result.reservationId} (strategy: ${variant}, latency: ${latencySeconds}s)`,
          'InventoryService',
        );

      return result;
    } catch (error: any) {
        const latencySeconds = (Date.now() - startTime) / 1000;
        const reason = this.extractFailureReason(error.message || 'unknown');

        // Record failure metric
        this.prometheusService.recordInventoryReservationFailure(
          variant,
          reason,
          latencySeconds,
        );

        // Record experiment conversion (failure)
        if (inExperiment) {
          await this.experimentsService.recordConversion(
            'inventory.reservation_strategy',
            subjectId,
            variant,
            'reservation_failure',
            {
              sku_id: skuId,
              quantity,
              reason,
              latency_seconds: latencySeconds,
              error: error.message,
            },
          );
        }

        throw error;
      }
  }

  /**
   * Extract failure reason from error message.
   *
   * @param errorMessage - Error message
   * @returns Normalized failure reason
   */
  private extractFailureReason(errorMessage: string): string {
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('insufficient stock') || lowerMessage.includes('stock')) {
      return 'insufficient_stock';
    }
    if (lowerMessage.includes('not found') || lowerMessage.includes('does not exist')) {
      return 'not_found';
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return 'timeout';
    }
    if (lowerMessage.includes('lock') || lowerMessage.includes('deadlock')) {
      return 'lock_contention';
    }

    return 'unknown';
  }

  /**
   * Commit a reservation.
   *
   * This method:
   * 1. Commits reservation using the strategy that created it
   * 2. Records commit metric
   * 3. Emits inventory.committed event
   *
   * Used when an order is placed and paid.
   *
   * Note: Strategy is determined from reservation metadata or default.
   * In future, we could store strategy in reservation metadata.
   *
   * @param commitDto - Commit reservation data
   * @param requestId - Optional request ID for event correlation
   * @param traceId - Optional trace ID for distributed tracing
   * @returns Success status
   */
  async commit(
    commitDto: CommitReservationDto,
    requestId?: string,
    traceId?: string,
  ) {
    const { reservationId, orderId } = commitDto;

    // Get reservation to find which strategy was used
    // For now, use default strategy (in future, store strategy in reservation metadata)
    const strategy = this.defaultStrategy;
    const variant = strategy.name;

    // Commit reservation
    const success = await strategy.commit({ reservationId, orderId });

    if (!success) {
      throw new BadRequestException('Failed to commit reservation');
    }

    // Record commit metric
    this.prometheusService.recordInventoryReservationCommit(variant);

    // Emit inventory.committed event
    await this.outboxService.writeEvent({
      topic: 'inventory.committed',
      event: this.outboxService.createEvent(
        'inventory.committed.v1',
        {
          reservation_id: reservationId,
          order_id: orderId,
          strategy: variant,
        },
        {
          trace_id: traceId,
          request_id: requestId,
        },
      ),
    });

    this.logger.log(
      `Reservation committed: ${reservationId}${orderId ? ` for order ${orderId}` : ''} (strategy: ${variant})`,
      'InventoryService',
    );

    return { success: true };
  }

  /**
   * Release a reservation.
   *
   * This method:
   * 1. Releases reservation using the strategy that created it
   * 2. Returns stock to available inventory
   * 3. Records release metric
   * 4. Emits inventory.released event
   *
   * Used when cart is abandoned or checkout is cancelled.
   *
   * @param releaseDto - Release reservation data
   * @param requestId - Optional request ID for event correlation
   * @param traceId - Optional trace ID for distributed tracing
   * @returns Success status
   */
  async release(
    releaseDto: ReleaseReservationDto,
    requestId?: string,
    traceId?: string,
  ) {
    const { reservationId, reason } = releaseDto;

    // Get reservation to find which strategy was used
    // For now, use default strategy
    const strategy = this.defaultStrategy;
    const variant = strategy.name;

    // Release reservation
    const success = await strategy.release({ reservationId, reason });

    if (!success) {
      throw new BadRequestException('Failed to release reservation');
    }

    // Record release metric
    this.prometheusService.recordInventoryReservationRelease(variant);

    // Emit inventory.released event
    await this.outboxService.writeEvent({
      topic: 'inventory.released',
      event: this.outboxService.createEvent(
        'inventory.released.v1',
        {
          reservation_id: reservationId,
          reason: reason || 'manual',
          strategy: variant,
        },
        {
          trace_id: traceId,
          request_id: requestId,
        },
      ),
    });

    this.logger.log(
      `Reservation released: ${reservationId} (reason: ${reason || 'none'}, strategy: ${variant})`,
      'InventoryService',
    );

    return { success: true };
  }

  /**
   * Get stock for a product variant.
   *
   * @param skuId - Product variant SKU ID
   * @returns Stock information
   */
  async getStock(skuId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: skuId },
      select: {
        id: true,
        sku: true,
        stock: true,
      },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant with SKU ID ${skuId} not found`);
    }

    // Get active reservations for this SKU
    const activeReservations = await (this.prisma as any).inventoryReservation.count({
      where: {
        skuId,
        status: 'RESERVED',
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    return {
      skuId: variant.id,
      sku: variant.sku,
      availableStock: variant.stock,
      reservedStock: activeReservations,
      totalStock: variant.stock + activeReservations,
    };
  }
}

