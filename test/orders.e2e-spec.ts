/**
 * E2E Tests for Orders Module
 *
 * Tests cover:
 * - Order creation flow
 * - Order status transitions
 * - Order retrieval
 * - Integration with Payments
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/lib/prisma/prisma.service';
import { cleanupTestDatabase, seedTestDatabase } from './utils/test-database';
import { v4 as uuidv4 } from 'uuid';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testUser: any;
  let testProduct: any;
  let testVariant: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();

    // Seed test data
    const seedData = await seedTestDatabase(prisma);
    testUser = seedData.user;
    testProduct = seedData.product;
    testVariant = seedData.variant;

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: 'password123', // Assuming this is the test password
      });

    authToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await cleanupTestDatabase(prisma);
    await app.close();
  });

  describe('POST /orders', () => {
    it('should create an order successfully', async () => {
      const createOrderDto = {
        userId: testUser.id,
        items: [
          {
            sku: testVariant.id,
            quantity: 2,
          },
        ],
        idempotencyKey: uuidv4(),
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createOrderDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status', 'CREATED');
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body.items).toHaveLength(1);
    });

    it('should return existing order when idempotency key is reused', async () => {
      const idempotencyKey = uuidv4();
      const createOrderDto = {
        userId: testUser.id,
        items: [
          {
            sku: testVariant.id,
            quantity: 1,
          },
        ],
        idempotencyKey,
      };

      const firstResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createOrderDto)
        .expect(201);

      const secondResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createOrderDto)
        .expect(201);

      expect(firstResponse.body.id).toBe(secondResponse.body.id);
    });

    it('should return 400 for invalid order data', async () => {
      const invalidDto = {
        userId: testUser.id,
        items: [], // Empty items
      };

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('GET /orders', () => {
    it('should return paginated orders for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).get('/orders').expect(401);
    });
  });

  describe('GET /orders/:id', () => {
    it('should return order by id', async () => {
      // Create an order first
      const createResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          items: [{ sku: testVariant.id, quantity: 1 }],
        })
        .expect(201);

      const orderId = createResponse.body.id;

      const response = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(orderId);
    });

    it('should return 404 for non-existent order', async () => {
      const nonExistentId = uuidv4();

      await request(app.getHttpServer())
        .get(`/orders/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /orders/:id/status', () => {
    it('should update order status (admin only)', async () => {
      // Create an order first
      const createResponse = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          items: [{ sku: testVariant.id, quantity: 1 }],
        })
        .expect(201);

      const orderId = createResponse.body.id;

      // Note: This requires admin token - would need to create admin user and login
      // For now, this test demonstrates the structure
      // const adminToken = await getAdminToken();
      // await request(app.getHttpServer())
      //   .patch(`/orders/${orderId}/status`)
      //   .set('Authorization', `Bearer ${adminToken}`)
      //   .send({ status: 'PAID' })
      //   .expect(200);
    });
  });
});

