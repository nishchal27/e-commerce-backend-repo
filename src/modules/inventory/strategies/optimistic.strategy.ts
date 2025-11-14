/**
 * Optimistic Reservation Strategy
 *
 * This strategy uses optimistic locking for inventory reservations.
 * It checks stock availability and reserves if available, without locking.
 *
 * How It Works:
 * 1. Read current stock from database
 * 2. Check if stock is sufficient
 * 3. Create reservation record
 * 4. Update product variant stock (decrement)
 *
 * Pros:
 * - Fast (no locking overhead)
 * - Good for low-contention scenarios
 * - Simple implementation
 *
 * Cons:
 * - Race conditions possible (two requests can reserve same stock)
 * - May result in overselling under high concurrency
 * - Requires reconciliation for accuracy
 *
 * Use Case:
 * - Low to medium traffic
 * - Acceptable risk of occasional overselling
 * - Performance is priority
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../lib/prisma/prisma.service';
import {
  IReservationStrategy,
  ReservationData,
  ReservationResult,
  CommitReservationData,
  ReleaseReservationData,
} from '../interfaces/reservation-strategy.interface';
import { InventoryReservationStatus } from '@prisma/client';
import { Logger } from '../../../lib/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * OptimisticStrategy implements optimistic locking for inventory reservations
 */
@Injectable()
export class OptimisticStrategy implements IReservationStrategy {
  readonly name = 'optimistic';
  private readonly defaultTtlSeconds = 900; // 15 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  /**
   * Reserve inventory using optimistic locking.
   *
   * This method:
   * 1. Reads current stock (no lock)
   * 2. Checks if stock is sufficient
   * 3. Creates reservation record
   * 4. Decrements stock atomically
   *
   * Note: Race conditions are possible if two requests reserve simultaneously.
   * The database constraint on stock >= 0 helps prevent negative stock.
   *
   * @param data - Reservation data
   * @returns Reservation result
   */
  async reserve(data: ReservationData): Promise<ReservationResult> {
    const { skuId, quantity, reservedBy, ttlSeconds } = data;
    const ttl = ttlSeconds || this.defaultTtlSeconds;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    try {
      // Find product variant by SKU ID
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: skuId },
      });

      if (!variant) {
        return {
          success: false,
          error: `Product variant with SKU ID ${skuId} not found`,
        };
      }

      // Check stock availability (optimistic: no lock)
      if (variant.stock < quantity) {
        return {
          success: false,
          error: `Insufficient stock: requested ${quantity}, available ${variant.stock}`,
          availableStock: variant.stock,
        };
      }

      // Create reservation and decrement stock in transaction
      const reservation = await this.prisma.$transaction(async (tx) => {
        // Re-check stock within transaction (helps reduce race conditions)
        const currentVariant = await tx.productVariant.findUnique({
          where: { id: skuId },
        });

        if (!currentVariant || currentVariant.stock < quantity) {
          throw new Error(
            `Insufficient stock: requested ${quantity}, available ${currentVariant?.stock || 0}`,
          );
        }

        // Create reservation
        const newReservation = await (tx as any).inventoryReservation.create({
          data: {
            id: uuidv4(),
            skuId,
            quantity,
            reservedBy,
            status: InventoryReservationStatus.RESERVED,
            expiresAt,
          },
        });

        // Decrement stock atomically
        await tx.productVariant.update({
          where: { id: skuId },
          data: {
            stock: {
              decrement: quantity,
            },
          },
        });

        return newReservation;
      });

      this.logger.debug(
        `Reservation created (optimistic): ${reservation.id} for SKU ${skuId}, quantity ${quantity}`,
        'OptimisticStrategy',
      );

      return {
        success: true,
        reservationId: reservation.id,
        availableStock: variant.stock - quantity,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to reserve inventory (optimistic): ${error.message}`,
        error.stack,
        'OptimisticStrategy',
      );

      return {
        success: false,
        error: error.message || 'Failed to reserve inventory',
      };
    }
  }

  /**
   * Commit a reservation.
   *
   * Marks reservation as CONSUMED (stock already decremented during reserve).
   *
   * @param data - Commit reservation data
   * @returns Success status
   */
  async commit(data: CommitReservationData): Promise<boolean> {
    const { reservationId } = data;

    try {
      await (this.prisma as any).inventoryReservation.update({
        where: { id: reservationId },
        data: {
          status: InventoryReservationStatus.CONSUMED,
        },
      });

      this.logger.debug(
        `Reservation committed: ${reservationId}`,
        'OptimisticStrategy',
      );

      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to commit reservation: ${error.message}`,
        error.stack,
        'OptimisticStrategy',
      );

      return false;
    }
  }

  /**
   * Release a reservation.
   *
   * Marks reservation as RELEASED and returns stock to available inventory.
   *
   * @param data - Release reservation data
   * @returns Success status
   */
  async release(data: ReleaseReservationData): Promise<boolean> {
    const { reservationId, reason } = data;

    try {
      // Get reservation to find SKU and quantity
      const reservation = await (this.prisma as any).inventoryReservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        this.logger.warn(
          `Reservation not found: ${reservationId}`,
          'OptimisticStrategy',
        );
        return false;
      }

      // Only release if status is RESERVED
      if (reservation.status !== InventoryReservationStatus.RESERVED) {
        this.logger.warn(
          `Cannot release reservation ${reservationId}: status is ${reservation.status}`,
          'OptimisticStrategy',
        );
        return false;
      }

      // Release reservation and restore stock in transaction
      await this.prisma.$transaction(async (tx) => {
        // Update reservation status
        await (tx as any).inventoryReservation.update({
          where: { id: reservationId },
          data: {
            status: InventoryReservationStatus.RELEASED,
          },
        });

        // Restore stock
        await tx.productVariant.update({
          where: { id: reservation.skuId },
          data: {
            stock: {
              increment: reservation.quantity,
            },
          },
        });
      });

      this.logger.debug(
        `Reservation released: ${reservationId} (reason: ${reason || 'none'})`,
        'OptimisticStrategy',
      );

      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to release reservation: ${error.message}`,
        error.stack,
        'OptimisticStrategy',
      );

      return false;
    }
  }
}

