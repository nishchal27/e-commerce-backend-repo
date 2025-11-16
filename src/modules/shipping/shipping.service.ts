/**
 * Shipping Service
 *
 * Business logic for shipping operations.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IShippingProvider, CreateShipmentData, ShippingRate } from './interfaces/shipping-provider.interface';
import { MockShippingProvider } from './providers/mock-shipping.provider';
import { OutboxService } from '../../common/events/outbox.service';
import { AuditLogService, AuditAction, AuditResource } from '../../common/audit/audit-log.service';
import { Logger } from '../../lib/logger';
import { PrismaService } from '../../lib/prisma/prisma.service';

@Injectable()
export class ShippingService {
  private readonly shippingProvider: IShippingProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
    private readonly mockShippingProvider: MockShippingProvider,
    private readonly logger: Logger,
  ) {
    const providerName = this.configService.get<string>('SHIPPING_PROVIDER', 'mock');

    if (providerName === 'mock') {
      this.shippingProvider = this.mockShippingProvider;
    } else {
      throw new Error(`Unsupported shipping provider: ${providerName}`);
    }

    this.logger.log(
      `ShippingService initialized with provider: ${this.shippingProvider.name}`,
      'ShippingService',
    );
  }

  /**
   * Get shipping rates for an order
   */
  async getRates(
    orderId: string,
    userId: string,
    requestId?: string,
    traceId?: string,
  ): Promise<ShippingRate[]> {
    // Verify order exists and belongs to user
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.userId !== userId) {
      throw new BadRequestException('Order does not belong to user');
    }

    // TODO: Get actual shipping addresses from order
    const shipmentData: CreateShipmentData = {
      orderId,
      from: {
        name: 'Warehouse',
        street1: '123 Warehouse St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
      },
      to: {
        name: 'Customer',
        street1: '456 Customer Ave',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90001',
        country: 'US',
      },
      weight: 1.5, // TODO: Calculate from order items
    };

    const rates = await this.shippingProvider.getRates(shipmentData);

    await this.auditLogService.logSuccess(
      userId,
      AuditAction.READ,
      AuditResource.ORDER,
      orderId,
      { action: 'get_shipping_rates', rates_count: rates.length },
      requestId,
      traceId,
    );

    return rates;
  }

  /**
   * Create a shipment for an order
   */
  async createShipment(
    orderId: string,
    service: string,
    userId: string,
    requestId?: string,
    traceId?: string,
  ) {
    // Verify order exists and is paid
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.status !== 'PAID') {
      throw new BadRequestException('Order must be paid before shipping');
    }

    // TODO: Get actual shipping addresses from order
    const shipmentData: CreateShipmentData = {
      orderId,
      from: {
        name: 'Warehouse',
        street1: '123 Warehouse St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
      },
      to: {
        name: 'Customer',
        street1: '456 Customer Ave',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90001',
        country: 'US',
      },
      weight: 1.5,
    };

    const shipment = await this.shippingProvider.createShipment(shipmentData);

    // Update order status to SHIPPED
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED' },
    });

    // Emit event
    await this.outboxService.writeEvent({
      topic: 'order.shipped',
      event: this.outboxService.createEvent(
        'order.shipped.v1',
        {
          order_id: orderId,
          shipment_id: shipment.shipmentId,
          tracking_number: shipment.trackingNumber,
          carrier: shipment.carrier,
        },
        {
          request_id: requestId,
          trace_id: traceId,
        },
      ),
    });

    await this.auditLogService.logSuccess(
      userId,
      AuditAction.CREATE,
      AuditResource.ORDER,
      orderId,
      { action: 'create_shipment', shipment_id: shipment.shipmentId },
      requestId,
      traceId,
    );

    this.logger.log(
      `Shipment created for order ${orderId}: ${shipment.trackingNumber}`,
      'ShippingService',
    );

    return shipment;
  }

  /**
   * Track a shipment
   */
  async trackShipment(trackingNumber: string) {
    return this.shippingProvider.trackShipment(trackingNumber);
  }
}

