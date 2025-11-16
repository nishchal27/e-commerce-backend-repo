/**
 * Mock Shipping Provider
 *
 * Mock implementation for development and testing.
 * In production, replace with actual shipping provider (FedEx, UPS, etc.).
 */

import { Injectable } from '@nestjs/common';
import { Logger } from '../../../lib/logger';
import {
  IShippingProvider,
  CreateShipmentData,
  ShippingRate,
  ShipmentResult,
} from '../interfaces/shipping-provider.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MockShippingProvider implements IShippingProvider {
  public readonly name = 'mock';

  constructor(private readonly logger: Logger) {}

  async getRates(data: CreateShipmentData): Promise<ShippingRate[]> {
    this.logger.debug(
      `Getting shipping rates for order ${data.orderId}`,
      'MockShippingProvider',
    );

    // Return mock rates
    return [
      {
        carrier: 'Mock Carrier',
        service: 'Standard',
        cost: 10.99,
        estimatedDays: 5,
        currency: 'USD',
      },
      {
        carrier: 'Mock Carrier',
        service: 'Express',
        cost: 24.99,
        estimatedDays: 2,
        currency: 'USD',
      },
    ];
  }

  async createShipment(data: CreateShipmentData): Promise<ShipmentResult> {
    this.logger.debug(
      `Creating shipment for order ${data.orderId}`,
      'MockShippingProvider',
    );

    return {
      shipmentId: `ship_${uuidv4()}`,
      trackingNumber: `TRACK${uuidv4().slice(0, 12).toUpperCase()}`,
      carrier: 'Mock Carrier',
      service: 'Standard',
      cost: 10.99,
      labelUrl: `https://example.com/labels/${uuidv4()}`,
      trackingUrl: `https://example.com/track/${uuidv4()}`,
    };
  }

  async trackShipment(trackingNumber: string): Promise<{
    status: string;
    location?: string;
    estimatedDelivery?: Date;
  }> {
    this.logger.debug(
      `Tracking shipment ${trackingNumber}`,
      'MockShippingProvider',
    );

    return {
      status: 'in_transit',
      location: 'Distribution Center',
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    };
  }

  async cancelShipment(shipmentId: string): Promise<boolean> {
    this.logger.debug(`Cancelling shipment ${shipmentId}`, 'MockShippingProvider');
    return true;
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
}

