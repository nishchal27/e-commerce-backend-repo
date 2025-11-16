/**
 * Unit Tests for OrdersService
 *
 * Tests cover:
 * - Order creation with idempotency
 * - Order status transitions
 * - Order retrieval
 * - Event emission
 * - Error handling
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { OutboxService } from '../../common/events/outbox.service';
import { PrometheusService } from '../../common/prometheus/prometheus.service';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { Logger } from '../../lib/logger';
import { OrderStatus } from '@prisma/client';
import {
  createMockPrismaService,
  createMockLogger,
  createMockPrometheusService,
  createMockOutboxService,
  createTestOrder,
  createTestUser,
} from '../../../test/utils/test-helpers';
import { v4 as uuidv4 } from 'uuid';

describe('OrdersService', () => {
  let service: OrdersService;
  let ordersRepository: OrdersRepository;
  let outboxService: OutboxService;
  let prometheusService: PrometheusService;
  let prismaService: any;
  let logger: any;

  const testUserId = uuidv4();
  const testOrderId = uuidv4();
  const testIdempotencyKey = uuidv4();

  beforeEach(async () => {
    const mockPrismaService = createMockPrismaService();
    const mockLogger = createMockLogger();
    const mockPrometheusService = createMockPrometheusService();
    const mockOutboxService = createMockOutboxService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        OrdersRepository,
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
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    ordersRepository = module.get<OrdersRepository>(OrdersRepository);
    outboxService = module.get<OutboxService>(OutboxService);
    prometheusService = module.get<PrometheusService>(PrometheusService);
    prismaService = module.get(PrismaService);
    logger = module.get(Logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createOrderDto = {
      userId: testUserId,
      totalAmount: 99.99,
      idempotencyKey: testIdempotencyKey,
    };

    it('should create a new order successfully', async () => {
      const newOrder = createTestOrder({
        id: testOrderId,
        userId: testUserId,
        totalAmount: { toNumber: () => 99.99 },
        idempotencyKey: testIdempotencyKey,
        user: createTestUser({ id: testUserId }),
      });

      prismaService.$transaction.mockImplementation((callback) => {
        const tx = {
          order: {
            create: jest.fn().mockResolvedValue(newOrder),
          },
        };
        return callback(tx);
      });

      ordersRepository.create = jest.fn().mockResolvedValue(newOrder);
      outboxService.writeEvent = jest.fn().mockResolvedValue(undefined);
      outboxService.createEvent = jest.fn().mockReturnValue({
        event_id: uuidv4(),
        event_type: 'order.created.v1',
        timestamp: new Date().toISOString(),
        source: 'orders-service',
        payload: { orderId: testOrderId },
      });

      const result = await service.create(createOrderDto, testUserId);

      expect(result).toBeDefined();
      expect(result.id).toBe(testOrderId);
      expect(ordersRepository.create).toHaveBeenCalledWith(
        { ...createOrderDto, userId: testUserId },
        expect.anything(),
      );
      expect(outboxService.writeEvent).toHaveBeenCalled();
      expect(prometheusService.recordOrderCreated).toHaveBeenCalledWith(true);
    });

    it('should return existing order when idempotency key is reused', async () => {
      const existingOrder = createTestOrder({
        id: testOrderId,
        userId: testUserId,
        idempotencyKey: testIdempotencyKey,
        user: createTestUser({ id: testUserId }),
      });

      ordersRepository.findByIdempotencyKey = jest
        .fn()
        .mockResolvedValue(existingOrder);

      const result = await service.create(createOrderDto, testUserId);

      expect(result.id).toBe(testOrderId);
      expect(ordersRepository.findByIdempotencyKey).toHaveBeenCalledWith(
        testIdempotencyKey,
      );
      expect(ordersRepository.create).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Duplicate order creation attempt'),
        'OrdersService',
      );
    });

    it('should throw BadRequestException when totalAmount is invalid', async () => {
      const invalidDto = { ...createOrderDto, totalAmount: -10 };

      await expect(service.create(invalidDto, testUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated orders for a user', async () => {
      const orders = [
        createTestOrder({ id: uuidv4(), userId: testUserId }),
        createTestOrder({ id: uuidv4(), userId: testUserId }),
      ];

      ordersRepository.findAll = jest.fn().mockResolvedValue(orders);
      ordersRepository.count = jest.fn().mockResolvedValue(2);

      const result = await service.findAll(testUserId, 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(ordersRepository.findAll).toHaveBeenCalledWith(0, 20, testUserId);
    });
  });

  describe('findOne', () => {
    it('should return an order by id', async () => {
      const order = createTestOrder({ id: testOrderId, userId: testUserId });

      ordersRepository.findById = jest.fn().mockResolvedValue(order);

      const result = await service.findOne(testOrderId);

      expect(result).toBeDefined();
      expect(result.id).toBe(testOrderId);
      expect(ordersRepository.findById).toHaveBeenCalledWith(testOrderId);
    });

    it('should throw NotFoundException when order does not exist', async () => {
      ordersRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(service.findOne(testOrderId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update order status successfully', async () => {
      const order = createTestOrder({
        id: testOrderId,
        userId: testUserId,
        status: OrderStatus.CREATED,
      });

      const updatedOrder = {
        ...order,
        status: OrderStatus.PAID,
      };

      ordersRepository.findById = jest.fn().mockResolvedValue(order);
      ordersRepository.updateStatus = jest.fn().mockResolvedValue(updatedOrder);
      outboxService.writeEvent = jest.fn().mockResolvedValue(undefined);
      outboxService.createEvent = jest.fn().mockReturnValue({
        event_id: uuidv4(),
        event_type: 'order.status.updated.v1',
        timestamp: new Date().toISOString(),
        source: 'orders-service',
        payload: { orderId: testOrderId, status: OrderStatus.PAID },
      });

      prismaService.$transaction.mockImplementation((callback) => {
        const tx = {
          order: {
            update: jest.fn().mockResolvedValue(updatedOrder),
          },
        };
        return callback(tx);
      });

      const result = await service.updateStatus(
        testOrderId,
        OrderStatus.PAID,
      );

      expect(result.status).toBe(OrderStatus.PAID);
      expect(ordersRepository.updateStatus).toHaveBeenCalledWith(
        testOrderId,
        OrderStatus.PAID,
        expect.anything(),
      );
      expect(outboxService.writeEvent).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      const order = createTestOrder({
        id: testOrderId,
        status: OrderStatus.CANCELLED, // Terminal status
      });

      ordersRepository.findById = jest.fn().mockResolvedValue(order);

      await expect(
        service.updateStatus(testOrderId, OrderStatus.PAID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when order does not exist', async () => {
      ordersRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(
        service.updateStatus(testOrderId, OrderStatus.PAID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

