/**
 * Payments Module
 *
 * This module encapsulates all payment-related functionality:
 * - PaymentsController: HTTP endpoints
 * - PaymentsService: Business logic (payment processing, webhooks)
 * - Payment Providers: Stripe, PayPal (future)
 *
 * Responsibilities:
 * - Payment intent creation and confirmation
 * - Webhook handling with signature verification
 * - Payment reconciliation
 * - Integration with Orders module
 * - Event emission via Outbox pattern
 *
 * Integration:
 * - Uses PrismaModule for database access
 * - Uses EventsModule for event publishing (OutboxService)
 * - Uses PrometheusModule for metrics
 * - Uses AuthModule guards for authentication/authorization
 * - Uses OrdersModule (imported) for order status updates
 *
 * Payment Providers:
 * - StripeProvider: Stripe payment processing
 * - PayPalProvider: PayPal payment processing (future)
 * - Provider selected via PAYMENT_PROVIDER environment variable
 */

import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeProvider } from './providers/stripe.provider';
import { PrismaModule } from '../../lib/prisma/prisma.module';
import { EventsModule } from '../../common/events/events.module';
import { PrometheusModule } from '../../common/prometheus/prometheus.module';
import { BullModule } from '@nestjs/bullmq';

/**
 * PaymentsModule provides payment processing functionality
 */
@Module({
  imports: [
    // Prisma for database access
    PrismaModule,
    // Events module for OutboxService (event publishing)
    EventsModule,
    // Prometheus for metrics
    PrometheusModule,
    // BullMQ for webhook retry queue
    BullModule.registerQueue({
      name: 'webhook-retry',
    }),
  ],
  controllers: [PaymentsController],
  providers: [
    // Payment providers
    StripeProvider,
    // Payments service (uses providers)
    PaymentsService,
  ],
  exports: [PaymentsService], // Export service for use in other modules
})
export class PaymentsModule {}

