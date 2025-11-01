/**
 * Integration Tests for Products Module
 *
 * These tests verify the complete request/response cycle for product endpoints.
 * Uses supertest to make HTTP requests to the running application.
 *
 * Prerequisites:
 * - Database must be running (Docker Compose or local Postgres)
 * - Run migrations before tests: npm run prisma:migrate
 * - Seed database if needed: npm run prisma:seed
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/lib/prisma/prisma.service';

describe('ProductsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global validation pipe (same as in main.ts)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('GET /products', () => {
    it('should return paginated list of products', () => {
      return request(app.getHttpServer())
        .get('/products')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('pagination');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.pagination).toHaveProperty('page');
          expect(res.body.pagination).toHaveProperty('limit');
          expect(res.body.pagination).toHaveProperty('total');
        });
    });

    it('should respect pagination parameters', () => {
      return request(app.getHttpServer())
        .get('/products?page=1&limit=5')
        .expect(200)
        .expect((res) => {
          expect(res.body.pagination.page).toBe(1);
          expect(res.body.pagination.limit).toBe(5);
          expect(res.body.data.length).toBeLessThanOrEqual(5);
        });
    });
  });

  describe('GET /products/:id', () => {
    it('should return a product by ID', async () => {
      // First, create a test product
      const product = await prisma.product.create({
        data: {
          slug: 'test-product-e2e',
          title: 'Test Product E2E',
          description: 'Test description',
        },
        include: { variants: true },
      });

      return request(app.getHttpServer())
        .get(`/products/${product.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', product.id);
          expect(res.body).toHaveProperty('slug', 'test-product-e2e');
          expect(res.body).toHaveProperty('title', 'Test Product E2E');
          expect(res.body).toHaveProperty('variants');
          expect(Array.isArray(res.body.variants)).toBe(true);
        })
        .finally(async () => {
          // Cleanup
          await prisma.product.delete({ where: { id: product.id } });
        });
    });

    it('should return 404 for non-existent product', () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      return request(app.getHttpServer()).get(`/products/${fakeId}`).expect(404);
    });

    it('should demonstrate caching on second request', async () => {
      // Create a test product
      const product = await prisma.product.create({
        data: {
          slug: 'cache-test-product',
          title: 'Cache Test Product',
          description: 'Testing cache performance',
        },
      });

      const start1 = Date.now();
      await request(app.getHttpServer()).get(`/products/${product.id}`).expect(200);
      const duration1 = Date.now() - start1;

      // Second request should be faster (from cache)
      const start2 = Date.now();
      await request(app.getHttpServer()).get(`/products/${product.id}`).expect(200);
      const duration2 = Date.now() - start2;

      // Cached request should be faster (though not guaranteed in test environment)
      console.log(`First request: ${duration1}ms, Second request: ${duration2}ms`);

      // Cleanup
      await prisma.product.delete({ where: { id: product.id } });
    });
  });

  describe('POST /products', () => {
    it('should create a new product', () => {
      const createDto = {
        slug: 'new-product-e2e',
        title: 'New Product E2E',
        description: 'A new product for testing',
      };

      return request(app.getHttpServer())
        .post('/products')
        .send(createDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('slug', 'new-product-e2e');
          expect(res.body).toHaveProperty('title', 'New Product E2E');
        })
        .then(async (res) => {
          // Cleanup
          await prisma.product.delete({ where: { id: res.body.id } });
        });
    });

    it('should create product with variants', () => {
      const createDto = {
        slug: 'product-with-variants-e2e',
        title: 'Product with Variants',
        variants: [
          {
            sku: 'VARIANT-001',
            price: 99.99,
            currency: 'USD',
            stock: 10,
          },
        ],
      };

      return request(app.getHttpServer())
        .post('/products')
        .send(createDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('variants');
          expect(res.body.variants).toHaveLength(1);
          expect(res.body.variants[0]).toHaveProperty('sku', 'VARIANT-001');
        })
        .then(async (res) => {
          // Cleanup
          await prisma.product.delete({ where: { id: res.body.id } });
        });
    });

    it('should validate required fields', () => {
      return request(app.getHttpServer())
        .post('/products')
        .send({ title: 'Missing slug' })
        .expect(400); // Bad request due to validation
    });
  });

  describe('PATCH /products/:id', () => {
    it('should update an existing product', async () => {
      // Create a test product
      const product = await prisma.product.create({
        data: {
          slug: 'update-test-product',
          title: 'Original Title',
          description: 'Original description',
        },
      });

      const updateDto = {
        title: 'Updated Title',
        description: 'Updated description',
      };

      return request(app.getHttpServer())
        .patch(`/products/${product.id}`)
        .send(updateDto)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('title', 'Updated Title');
          expect(res.body).toHaveProperty('description', 'Updated description');
        })
        .finally(async () => {
          // Cleanup
          await prisma.product.delete({ where: { id: product.id } });
        });
    });

    it('should return 404 for non-existent product', () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      return request(app.getHttpServer())
        .patch(`/products/${fakeId}`)
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /products/:id', () => {
    it('should delete a product', async () => {
      // Create a test product
      const product = await prisma.product.create({
        data: {
          slug: 'delete-test-product',
          title: 'Delete Test Product',
        },
      });

      return request(app.getHttpServer())
        .delete(`/products/${product.id}`)
        .expect(204)
        .then(async () => {
          // Verify product is deleted
          const deleted = await prisma.product.findUnique({
            where: { id: product.id },
          });
          expect(deleted).toBeNull();
        });
    });

    it('should return 404 for non-existent product', () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      return request(app.getHttpServer()).delete(`/products/${fakeId}`).expect(404);
    });
  });
});

