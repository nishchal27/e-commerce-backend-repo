/**
 * Unit Tests for InventoryService
 *
 * Tests cover:
 * - Inventory reservation (optimistic and pessimistic strategies)
 * - Reservation commitment
 * - Reservation release
 * - Stock retrieval
 * - A/B testing integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { OptimisticStrategy } from './strategies/optimistic.strategy';
import { PessimisticStrategy } from './strategies/pessimistic.strategy';
import { ExperimentsService } from '../experiments/experiments.service';
import { OutboxService } from '../../common/events/outbox.service';
import { PrometheusService } from '../../common/prometheus/prometheus.service';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { Logger } from '../../lib/logger';
import { ConfigService } from '@nestjs/config';
import {
  createMockPrismaService,
  createMockLogger,
  createMockPrometheusService,
  createMockOutboxService,
} from '../../../test/utils/test-helpers';
import { v4 as uuidv4 } from 'uuid';

describe('InventoryService', () => {
  let service: InventoryService;
  let optimisticStrategy: OptimisticStrategy;
  let pessimisticStrategy: PessimisticStrategy;
  let experimentsService: ExperimentsService;
  let prismaService: any;
  let prometheusService: PrometheusService;
  let outboxService: OutboxService;

  const testSkuId = uuidv4();

  beforeEach(async () => {
    const mockPrismaService = createMockPrismaService();
    const mockLogger = createMockLogger();
    const mockPrometheusService = createMockPrometheusService();
    const mockOutboxService = createMockOutboxService();
    const mockExperimentsService = {
      assignVariant: jest.fn().mockReturnValue({
        variant: 'optimistic',
        inExperiment: false,
      }),
      recordConversion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        OptimisticStrategy,
        PessimisticStrategy,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ExperimentsService,
          useValue: mockExperimentsService,
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
              if (key === 'INVENTORY_RESERVATION_STRATEGY') return 'optimistic';
              return defaultValue;
            }),
          },
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    optimisticStrategy = module.get<OptimisticStrategy>(OptimisticStrategy);
    pessimisticStrategy = module.get<PessimisticStrategy>(PessimisticStrategy);
    experimentsService = module.get<ExperimentsService>(ExperimentsService);
    prismaService = module.get(PrismaService);
    prometheusService = module.get(PrometheusService);
    outboxService = module.get(OutboxService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reserve', () => {
    const reserveDto = {
      skuId: testSkuId,
      quantity: 2,
      reservedBy: uuidv4(),
      ttlSeconds: 900,
    };

    it('should reserve inventory successfully with optimistic strategy', async () => {
      const reservationResult = {
        success: true,
        reservationId: uuidv4(),
        availableStock: 98,
      };

      optimisticStrategy.reserve = jest.fn().mockResolvedValue(reservationResult);
      outboxService.writeEvent = jest.fn().mockResolvedValue(undefined);
      outboxService.createEvent = jest.fn().mockReturnValue({
        event_id: uuidv4(),
        event_type: 'inventory.reserved.v1',
        timestamp: new Date().toISOString(),
        source: 'inventory-service',
        payload: {},
      });

      const result = await service.reserve(reserveDto);

      expect(result.success).toBe(true);
      expect(result.reservationId).toBeDefined();
      expect(optimisticStrategy.reserve).toHaveBeenCalled();
      expect(prometheusService.recordInventoryReservationAttempt).toHaveBeenCalled();
      expect(prometheusService.recordInventoryReservationSuccess).toHaveBeenCalled();
      expect(outboxService.writeEvent).toHaveBeenCalled();
    });

    it('should throw BadRequestException when reservation fails', async () => {
      const reservationResult = {
        success: false,
        error: 'Insufficient stock',
      };

      optimisticStrategy.reserve = jest.fn().mockResolvedValue(reservationResult);

      await expect(service.reserve(reserveDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prometheusService.recordInventoryReservationFailure).toHaveBeenCalled();
    });

    it('should use pessimistic strategy when assigned by experiment', async () => {
      const reservationResult = {
        success: true,
        reservationId: uuidv4(),
        availableStock: 98,
      };

      (experimentsService.assignVariant as jest.Mock).mockReturnValue({
        variant: 'pessimistic',
        inExperiment: true,
      });

      pessimisticStrategy.reserve = jest.fn().mockResolvedValue(reservationResult);
      outboxService.writeEvent = jest.fn().mockResolvedValue(undefined);
      outboxService.createEvent = jest.fn().mockReturnValue({
        event_id: uuidv4(),
        event_type: 'inventory.reserved.v1',
        timestamp: new Date().toISOString(),
        source: 'inventory-service',
        payload: {},
      });

      await service.reserve(reserveDto);

      expect(pessimisticStrategy.reserve).toHaveBeenCalled();
      expect(experimentsService.recordConversion).toHaveBeenCalled();
    });
  });

  describe('commit', () => {
    const commitDto = {
      reservationId: uuidv4(),
      orderId: uuidv4(),
    };

    it('should commit reservation successfully', async () => {
      optimisticStrategy.commit = jest.fn().mockResolvedValue(true);
      outboxService.writeEvent = jest.fn().mockResolvedValue(undefined);

      const result = await service.commit(commitDto);

      expect(result).toBe(true);
      expect(optimisticStrategy.commit).toHaveBeenCalledWith(commitDto);
      expect(prometheusService.recordInventoryReservationCommit).toHaveBeenCalled();
    });
  });

  describe('release', () => {
    const releaseDto = {
      reservationId: uuidv4(),
      reason: 'cart_abandoned',
    };

    it('should release reservation successfully', async () => {
      optimisticStrategy.release = jest.fn().mockResolvedValue(true);
      outboxService.writeEvent = jest.fn().mockResolvedValue(undefined);

      const result = await service.release(releaseDto);

      expect(result).toBe(true);
      expect(optimisticStrategy.release).toHaveBeenCalledWith(releaseDto);
      expect(prometheusService.recordInventoryReservationRelease).toHaveBeenCalled();
    });
  });

  describe('getStock', () => {
    it('should return stock for a SKU', async () => {
      const variant = {
        id: testSkuId,
        stock: 100,
      };

      prismaService.productVariant.findUnique = jest
        .fn()
        .mockResolvedValue(variant);

      const result = await service.getStock(testSkuId);

      expect(result.stock).toBe(100);
      expect(prismaService.productVariant.findUnique).toHaveBeenCalledWith({
        where: { id: testSkuId },
        select: { stock: true },
      });
    });
  });
});

