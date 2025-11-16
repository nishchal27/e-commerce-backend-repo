/**
 * Shipping Provider Interface
 *
 * Defines the interface for shipping providers (FedEx, UPS, etc.).
 * Allows for interchangeable shipping provider implementations.
 */

export interface ShippingRate {
  carrier: string;
  service: string;
  cost: number;
  estimatedDays: number;
  currency: string;
}

export interface ShippingAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface CreateShipmentData {
  orderId: string;
  from: ShippingAddress;
  to: ShippingAddress;
  weight: number; // in kg
  dimensions?: {
    length: number; // in cm
    width: number; // in cm
    height: number; // in cm
  };
}

export interface ShipmentResult {
  shipmentId: string;
  trackingNumber: string;
  carrier: string;
  service: string;
  cost: number;
  labelUrl?: string; // URL to shipping label
  trackingUrl?: string; // URL to track shipment
}

export interface IShippingProvider {
  name: string;
  getRates(data: CreateShipmentData): Promise<ShippingRate[]>;
  createShipment(data: CreateShipmentData): Promise<ShipmentResult>;
  trackShipment(trackingNumber: string): Promise<{
    status: string;
    location?: string;
    estimatedDelivery?: Date;
  }>;
  cancelShipment(shipmentId: string): Promise<boolean>;
  isHealthy(): Promise<boolean>;
}

