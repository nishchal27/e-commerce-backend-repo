/**
 * Products Service
 *
 * This service contains the business logic for product operations.
 * It coordinates between the repository (data access) and controller (HTTP layer).
 *
 * Responsibilities:
 * - Business logic validation
 * - Cache management (LRU cache for product details)
 * - Coordinating repository calls
 * - Error handling and transformation
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductsRepository, ProductWithVariants } from './products.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { mapProductToDto } from './products.mapper';
import { LRUCache } from '../../algorithms/lru';
import { RedisService } from '../../lib/redis/redis.service';
import { Logger } from '../../lib/logger';

/**
 * ProductsService handles business logic for product operations
 */
@Injectable()
export class ProductsService {
  // In-memory LRU cache for product details
  private readonly lruCache: LRUCache<ProductWithVariants>;

  // Cache TTL in seconds (for Redis)
  private readonly cacheTtl: number;

  // Whether to use in-memory cache or Redis
  private readonly useInMemoryCache: boolean;

  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    // Initialize LRU cache if in-memory caching is enabled
    this.useInMemoryCache = this.configService.get<boolean>('USE_IN_MEMORY_CACHE', true);
    const lruMaxSize = this.configService.get<number>('LRU_CACHE_MAX_SIZE', 100);
    this.cacheTtl = this.configService.get<number>('CACHE_TTL', 3600);

    if (this.useInMemoryCache) {
      this.lruCache = new LRUCache<ProductWithVariants>(lruMaxSize);
      this.logger.log(`LRU cache initialized with capacity: ${lruMaxSize}`, 'ProductsService');
    }
  }

  /**
   * Get all products with pagination.
   *
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 20)
   * @returns Object containing products array and pagination metadata
   */
  async findAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
      this.productsRepository.findAll(skip, limit),
      this.productsRepository.count(),
    ]);

    return {
      data: products.map(mapProductToDto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single product by ID.
   * Implements read-through caching:
   * 1. Check in-memory LRU cache (if enabled)
   * 2. Check Redis cache (if enabled)
   * 3. Query database if not in cache
   * 4. Store in cache for future requests
   *
   * @param id - Product UUID
   * @returns Product with variants
   * @throws NotFoundException if product not found
   */
  async findOne(id: string): Promise<ProductResponseDto> {
    const cacheKey = `product:${id}`;
    const startTime = Date.now();

    // Try in-memory LRU cache first
    if (this.useInMemoryCache) {
      const cached = this.lruCache.get(cacheKey);
      if (cached) {
        const duration = Date.now() - startTime;
        this.logger.debug(
          `Product ${id} retrieved from LRU cache in ${duration}ms`,
          'ProductsService',
        );
        return mapProductToDto(cached);
      }
    }

    // Try Redis cache
    const redisClient = this.redisService.getClient();
    if (redisClient) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          const product = JSON.parse(cached) as ProductWithVariants;
          const duration = Date.now() - startTime;

          // Also store in LRU cache for faster subsequent access
          if (this.useInMemoryCache) {
            this.lruCache.put(cacheKey, product);
          }

          this.logger.debug(
            `Product ${id} retrieved from Redis cache in ${duration}ms`,
            'ProductsService',
          );
          return mapProductToDto(product);
        }
      } catch (error) {
        this.logger.warn(`Redis cache read error: ${error.message}`, 'ProductsService');
      }
    }

    // Cache miss: query database
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const duration = Date.now() - startTime;
    this.logger.debug(`Product ${id} retrieved from database in ${duration}ms`, 'ProductsService');

    // Store in caches for future requests (store the raw Prisma model)
    if (this.useInMemoryCache) {
      this.lruCache.put(cacheKey, product);
    }

    if (redisClient) {
      try {
        await redisClient.setex(cacheKey, this.cacheTtl, JSON.stringify(product));
      } catch (error) {
        this.logger.warn(`Redis cache write error: ${error.message}`, 'ProductsService');
      }
    }

    // Return mapped DTO
    return mapProductToDto(product);
  }

  /**
   * Create a new product.
   * Invalidates relevant caches after creation.
   *
   * @param createProductDto - Product creation data
   * @returns Created product with variants
   */
  async create(createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    const product = await this.productsRepository.create(createProductDto);
    this.logger.log(`Product created: ${product.id} (${product.slug})`, 'ProductsService');

    // Note: No cache invalidation needed for new products (not yet cached)

    return mapProductToDto(product);
  }

  /**
   * Update an existing product.
   * Invalidates cache entries for the updated product.
   *
   * @param id - Product UUID
   * @param updateProductDto - Product update data
   * @returns Updated product with variants
   * @throws NotFoundException if product not found
   */
  async update(id: string, updateProductDto: UpdateProductDto): Promise<ProductResponseDto> {
    // Check if product exists
    const existing = await this.productsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Update product
    const product = await this.productsRepository.update(id, updateProductDto);
    this.logger.log(`Product updated: ${product.id}`, 'ProductsService');

    // Invalidate cache
    await this.invalidateCache(id);

    return mapProductToDto(product);
  }

  /**
   * Delete a product.
   * Invalidates cache entries for the deleted product.
   *
   * @param id - Product UUID
   * @throws NotFoundException if product not found
   */
  async remove(id: string): Promise<void> {
    // Check if product exists
    const existing = await this.productsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Delete product
    await this.productsRepository.delete(id);
    this.logger.log(`Product deleted: ${id}`, 'ProductsService');

    // Invalidate cache
    await this.invalidateCache(id);
  }

  /**
   * Invalidate cache entries for a product.
   * Called when a product is updated or deleted.
   *
   * @param id - Product UUID
   */
  private async invalidateCache(id: string): Promise<void> {
    const cacheKey = `product:${id}`;

    // Remove from LRU cache
    if (this.useInMemoryCache) {
      this.lruCache.delete(cacheKey);
    }

    // Remove from Redis cache
    const redisClient = this.redisService.getClient();
    if (redisClient) {
      try {
        await redisClient.del(cacheKey);
      } catch (error) {
        this.logger.warn(`Redis cache delete error: ${error.message}`, 'ProductsService');
      }
    }
  }
}

