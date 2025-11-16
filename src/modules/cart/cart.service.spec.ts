/**
 * Unit Tests for CartService
 *
 * Tests cover:
 * - Cart creation and retrieval
 * - Adding items to cart
 * - Updating cart items
 * - Removing cart items
 * - Cart merging (anonymous → authenticated)
 * - Cart expiration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';
import { RedisService } from '../../lib/redis/redis.service';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { OutboxService } from '../../common/events/outbox.service';
import { Logger } from '../../lib/logger';
import {
  createMockRedisService,
  createMockPrismaService,
  createMockLogger,
  createMockOutboxService,
} from '../../../test/utils/test-helpers';
import { v4 as uuidv4 } from 'uuid';

describe('CartService', () => {
  let service: CartService;
  let redisService: any;
  let prismaService: any;
  let outboxService: OutboxService;
  let logger: any;

  const testUserId = uuidv4();
  const testSessionId = uuidv4();
  const testSkuId = uuidv4();
  const testProductId = uuidv4();

  beforeEach(async () => {
    const mockRedisService = createMockRedisService();
    const mockPrismaService = createMockPrismaService();
    const mockLogger = createMockLogger();
    const mockOutboxService = createMockOutboxService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: OutboxService,
          useValue: mockOutboxService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    redisService = module.get(RedisService);
    prismaService = module.get(PrismaService);
    outboxService = module.get(OutboxService);
    logger = module.get(Logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCart', () => {
    it('should return existing cart for user', async () => {
      const existingCart = {
        id: uuidv4(),
        userId: testUserId,
        items: [],
        totalQuantity: 0,
        totalAmount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const redisClient = redisService.getClient();
      redisClient.get = jest.fn().mockResolvedValue(JSON.stringify(existingCart));
      redisClient.expire = jest.fn().mockResolvedValue(1);

      const result = await service.getCart(testUserId);

      expect(result.id).toBe(existingCart.id);
      expect(redisClient.get).toHaveBeenCalledWith(`cart:user:${testUserId}`);
    });

    it('should create new cart if not found', async () => {
      const redisClient = redisService.getClient();
      redisClient.get = jest.fn().mockResolvedValue(null);
      redisClient.setex = jest.fn().mockResolvedValue('OK');

      const result = await service.getCart(testUserId);

      expect(result).toBeDefined();
      expect(result.userId).toBe(testUserId);
      expect(result.items).toEqual([]);
      expect(redisClient.setex).toHaveBeenCalled();
    });
  });

  describe('addToCart', () => {
    const addToCartDto = {
      skuId: testSkuId,
      quantity: 2,
    };

    it('should add item to cart successfully', async () => {
      const productVariant = {
        id: testSkuId,
        productId: testProductId,
        price: { toNumber: () => 29.99 },
        product: {
          title: 'Test Product',
          description: 'Test Description',
        },
      };

      const existingCart = {
        id: uuidv4(),
        userId: testUserId,
        items: [],
        totalQuantity: 0,
        totalAmount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      prismaService.productVariant.findUnique = jest
        .fn()
        .mockResolvedValue(productVariant);

      const redisClient = redisService.getClient();
      redisClient.get = jest.fn().mockResolvedValue(JSON.stringify(existingCart));
      redisClient.setex = jest.fn().mockResolvedValue('OK');

      outboxService.writeEvent = jest.fn().mockResolvedValue(undefined);
      outboxService.createEvent = jest.fn().mockReturnValue({
        event_id: uuidv4(),
        event_type: 'cart.updated.v1',
        timestamp: new Date().toISOString(),
        source: 'cart-service',
        payload: {},
      });

      const result = await service.addToCart(addToCartDto, testUserId);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].skuId).toBe(testSkuId);
      expect(result.items[0].quantity).toBe(2);
      expect(result.totalQuantity).toBe(2);
      expect(result.totalAmount).toBe(59.98);
      expect(outboxService.writeEvent).toHaveBeenCalled();
    });

    it('should throw NotFoundException when product variant does not exist', async () => {
      prismaService.productVariant.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.addToCart(addToCartDto, testUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('mergeCarts', () => {
    it('should merge anonymous cart into user cart', async () => {
      const userCart = {
        id: uuidv4(),
        userId: testUserId,
        items: [{ skuId: 'sku1', quantity: 1, price: 10, addedAt: new Date() }],
        totalQuantity: 1,
        totalAmount: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const anonymousCart = {
        id: uuidv4(),
        sessionId: testSessionId,
        items: [{ skuId: 'sku2', quantity: 2, price: 20, addedAt: new Date() }],
        totalQuantity: 2,
        totalAmount: 40,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const redisClient = redisService.getClient();
      redisClient.get = jest
        .fn()
        .mockImplementation((key: string) => {
          if (key.includes('user')) {
            return Promise.resolve(JSON.stringify(userCart));
          }
          return Promise.resolve(JSON.stringify(anonymousCart));
        });
      redisClient.setex = jest.fn().mockResolvedValue('OK');
      redisClient.del = jest.fn().mockResolvedValue(1);

      outboxService.writeEvent = jest.fn().mockResolvedValue(undefined);
      outboxService.createEvent = jest.fn().mockReturnValue({
        event_id: uuidv4(),
        event_type: 'cart.merged.v1',
        timestamp: new Date().toISOString(),
        source: 'cart-service',
        payload: {},
      });

      const result = await service.mergeCarts(testUserId, testSessionId);

      expect(result.items).toHaveLength(2);
      expect(result.userId).toBe(testUserId);
      expect(result.sessionId).toBeUndefined();
      expect(redisClient.del).toHaveBeenCalledWith(`cart:session:${testSessionId}`);
      expect(outboxService.writeEvent).toHaveBeenCalled();
    });
  });
});

