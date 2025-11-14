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
   * 1. Experiment assignment (if A/B testing)
   * 2. Configuration (default)
   *
   * TODO: Integrate with Experiments module for A/B testing
   *
   * @param userId - Optional user ID for experiment assignment
   * @returns Reservation strategy
   */
  private getStrategy(userId?: string): IReservationStrategy {
    // TODO: Check experiment assignment for this user
    // const experiment = await this.experimentsService.getAssignment('inventory.reservation_strategy', userId);
    // if (experiment) {
    //   return experiment.variant === 'pessimistic' ? this.pessimisticStrategy : this.optimisticStrategy;
    // }

    // Use default strategy
    return this.defaultStrategy;
  }

  /**
   * Reserve inventory.
   *
   * This method:
   * 1. Selects reservation strategy (optimistic or pessimistic)
   * 2. Reserves inventory using selected strategy
   * 3. Emits inventory.reserved event
   *
   * @param reserveDto - Reservation data
   * @param userId - Optional user ID (for experiment assignment)
   * @param requestId - Optional request ID for event correlation
   * @param traceId - Optional trace ID for distributed tracing
   * @returns Reservation result
   */
  async reserve(
    reserveDto: ReserveInventoryDto,
    userId?: string,
    requestId?: string,
    traceId?: string,
  ) {
    const { skuId, quantity, reservedBy, ttlSeconds } = reserveDto;

    // Get strategy
    const strategy = this.getStrategy(userId);

    // Reserve inventory
    const result = await strategy.reserve({
      skuId,
      quantity,
      reservedBy,
      ttlSeconds,
    });

    if (!result.success) {
      throw new BadRequestException(result.error || 'Failed to reserve inventory');
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
          strategy: strategy.name,
          available_stock: result.availableStock,
        },
        {
          trace_id: traceId,
          request_id: requestId,
        },
      ),
    });

    this.logger.log(
      `Inventory reserved: ${result.reservationId} for SKU ${skuId}, quantity ${quantity} (strategy: ${strategy.name})`,
      'InventoryService',
    );

    return result;
  }

  /**
   * Commit a reservation.
   *
   * This method:
   * 1. Commits reservation using the strategy that created it
   * 2. Emits inventory.committed event
   *
   * Used when an order is placed and paid.
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

    // Commit reservation
    const success = await strategy.commit({ reservationId, orderId });

    if (!success) {
      throw new BadRequestException('Failed to commit reservation');
    }

    // Emit inventory.committed event
    await this.outboxService.writeEvent({
      topic: 'inventory.committed',
      event: this.outboxService.createEvent(
        'inventory.committed.v1',
        {
          reservation_id: reservationId,
          order_id: orderId,
        },
        {
          trace_id: traceId,
          request_id: requestId,
        },
      ),
    });

    this.logger.log(
      `Reservation committed: ${reservationId}${orderId ? ` for order ${orderId}` : ''}`,
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
   * 3. Emits inventory.released event
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

    // Release reservation
    const success = await strategy.release({ reservationId, reason });

    if (!success) {
      throw new BadRequestException('Failed to release reservation');
    }

    // Emit inventory.released event
    await this.outboxService.writeEvent({
      topic: 'inventory.released',
      event: this.outboxService.createEvent(
        'inventory.released.v1',
        {
          reservation_id: reservationId,
          reason: reason || 'manual',
        },
        {
          trace_id: traceId,
          request_id: requestId,
        },
      ),
    });

    this.logger.log(
      `Reservation released: ${reservationId} (reason: ${reason || 'none'})`,
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

