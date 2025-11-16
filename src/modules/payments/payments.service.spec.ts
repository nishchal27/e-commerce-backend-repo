/**
 * Unit Tests for PaymentsService
 *
 * Tests cover:
 * - Payment creation with idempotency
 * - Payment confirmation
 * - Webhook processing
 * - Error handling
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { StripeProvider } from './providers/stripe.provider';
import { OutboxService } from '../../common/events/outbox.service';
import { PrometheusService } from '../../common/prometheus/prometheus.service';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '../../lib/logger';
import { PaymentStatus, OrderStatus } from '@prisma/client';
import {
  createMockPrismaService,
  createMockLogger,
  createMockPrometheusService,
  createMockOutboxService,
  createTestPayment,
  createTestOrder,
} from '../../../test/utils/test-helpers';
import { v4 as uuidv4 } from 'uuid';
import { getQueueToken } from '@nestjs/bullmq';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let stripeProvider: StripeProvider;
  let prismaService: any;
  let outboxService: OutboxService;
  let prometheusService: PrometheusService;
  let logger: any;
  let webhookRetryQueue: any;

  const testOrderId = uuidv4();
  const testPaymentId = uuidv4();
  const testPaymentIntentId = 'pi_test_123';

  beforeEach(async () => {
    const mockPrismaService = createMockPrismaService();
    const mockLogger = createMockLogger();
    const mockPrometheusService = createMockPrometheusService();
    const mockOutboxService = createMockOutboxService();
    const mockWebhookRetryQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        StripeProvider,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: OutboxService,
          useValue: mockOutboxService,
        },
        {
          provide: PrometheusService,
          useValue: mockPrometheusService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'PAYMENT_PROVIDER') return 'stripe';
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
              if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_123';
              return defaultValue;
            }),
          },
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
        {
          provide: getQueueToken('webhook-retry'),
          useValue: mockWebhookRetryQueue,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    stripeProvider = module.get<StripeProvider>(StripeProvider);
    prismaService = module.get(PrismaService);
    outboxService = module.get(OutboxService);
    prometheusService = module.get(PrometheusService);
    logger = module.get(Logger);
    webhookRetryQueue = module.get(getQueueToken('webhook-retry'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    const createPaymentDto = {
      orderId: testOrderId,
      amount: 99.99,
      currency: 'USD',
      paymentMethodType: 'card',
      idempotencyKey: uuidv4(),
    };

    it('should create a payment successfully', async () => {
      const order = createTestOrder({
        id: testOrderId,
        status: OrderStatus.CREATED,
        totalAmount: { toNumber: () => 99.99 },
      });

      const payment = createTestPayment({
        id: testPaymentId,
        orderId: testOrderId,
        paymentIntentId: testPaymentIntentId,
        status: PaymentStatus.PENDING,
      });

      prismaService.order.findUnique = jest.fn().mockResolvedValue(order);
      prismaService.payment.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.payment.create = jest.fn().mockResolvedValue(payment);
      stripeProvider.createPaymentIntent = jest.fn().mockResolvedValue({
        paymentIntentId: testPaymentIntentId,
        clientSecret: 'cs_test_123',
        status: PaymentStatus.PENDING,
      });
      outboxService.writeEvent = jest.fn().mockResolvedValue(undefined);
      outboxService.createEvent = jest.fn().mockReturnValue({
        event_id: uuidv4(),
        event_type: 'payment.created.v1',
        timestamp: new Date().toISOString(),
        source: 'payments-service',
        payload: { payment_id: testPaymentId },
      });

      const result = await service.createPayment(createPaymentDto);

      expect(result).toBeDefined();
      expect(result.paymentIntentId).toBe(testPaymentIntentId);
      expect(stripeProvider.createPaymentIntent).toHaveBeenCalled();
      expect(outboxService.writeEvent).toHaveBeenCalled();
      expect(prometheusService.recordPaymentCreated).toHaveBeenCalled();
    });

    it('should throw NotFoundException when order does not exist', async () => {
      prismaService.order.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.createPayment(createPaymentDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when order is not in CREATED status', async () => {
      const order = createTestOrder({
        id: testOrderId,
        status: OrderStatus.PAID,
      });

      prismaService.order.findUnique = jest.fn().mockResolvedValue(order);

      await expect(service.createPayment(createPaymentDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return existing payment when idempotency key is reused', async () => {
      const existingPayment = createTestPayment({
        id: testPaymentId,
        paymentIntentId: testPaymentIntentId,
        status: PaymentStatus.PENDING,
      });

      prismaService.payment.findUnique = jest
        .fn()
        .mockResolvedValue(existingPayment);

      const result = await service.createPayment(createPaymentDto);

      expect(result.paymentIntentId).toBe(testPaymentIntentId);
      expect(stripeProvider.createPaymentIntent).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('already exists'),
        'PaymentsService',
      );
    });
  });

  describe('confirmPayment', () => {
    const confirmPaymentDto = {
      paymentIntentId: testPaymentIntentId,
    };

    it('should confirm a payment successfully', async () => {
      const payment = createTestPayment({
        id: testPaymentId,
        paymentIntentId: testPaymentIntentId,
        status: PaymentStatus.PENDING,
      });

      const updatedPayment = {
        ...payment,
        status: PaymentStatus.SUCCEEDED,
      };

      prismaService.payment.findFirst = jest.fn().mockResolvedValue(payment);
      stripeProvider.confirmPayment = jest.fn().mockResolvedValue({
        paymentIntentId: testPaymentIntentId,
        clientSecret: undefined,
        status: PaymentStatus.SUCCEEDED,
      });
      prismaService.payment.update = jest.fn().mockResolvedValue(updatedPayment);
      prismaService.order.update = jest.fn().mockResolvedValue({});
      outboxService.writeEvent = jest.fn().mockResolvedValue(undefined);

      const result = await service.confirmPayment(confirmPaymentDto);

      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(stripeProvider.confirmPayment).toHaveBeenCalled();
      expect(outboxService.writeEvent).toHaveBeenCalled();
    });

    it('should throw NotFoundException when payment does not exist', async () => {
      prismaService.payment.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.confirmPayment(confirmPaymentDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('processWebhook', () => {
    const webhookPayload = {
      id: 'evt_test_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: testPaymentIntentId,
          status: 'succeeded',
        },
      },
    };

    it('should process payment succeeded webhook successfully', async () => {
      const payment = createTestPayment({
        id: testPaymentId,
        paymentIntentId: testPaymentIntentId,
        status: PaymentStatus.PENDING,
      });

      prismaService.payment.findFirst = jest.fn().mockResolvedValue(payment);
      stripeProvider.verifyWebhookSignature = jest.fn().mockReturnValue(true);
      stripeProvider.parseWebhookEvent = jest.fn().mockReturnValue(webhookPayload);
      prismaService.payment.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.payment.update = jest.fn().mockResolvedValue({
        ...payment,
        status: PaymentStatus.SUCCEEDED,
      });
      prismaService.order.update = jest.fn().mockResolvedValue({});
      outboxService.writeEvent = jest.fn().mockResolvedValue(undefined);

      const result = await service.processWebhook(webhookPayload, 'signature');

      expect(result.processed).toBe(true);
      expect(stripeProvider.verifyWebhookSignature).toHaveBeenCalled();
    });

    it('should queue webhook for retry on error', async () => {
      stripeProvider.verifyWebhookSignature = jest.fn().mockReturnValue(true);
      stripeProvider.parseWebhookEvent = jest.fn().mockReturnValue(webhookPayload);
      prismaService.payment.findFirst = jest.fn().mockRejectedValue(new Error('Database error'));

      await service.queueWebhookRetry(webhookPayload, 'signature', new Error('Test error'));

      expect(webhookRetryQueue.add).toHaveBeenCalled();
    });
  });
});

