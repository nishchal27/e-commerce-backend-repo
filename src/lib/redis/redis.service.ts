/**
 * Redis Service
 *
 * This service provides a Redis client connection using ioredis.
 * It handles:
 * - Redis connection initialization from environment variables
 * - Connection lifecycle management
 * - Graceful shutdown on application termination
 *
 * Used for:
 * - Caching (product details, etc.)
 * - Session storage (future)
 * - BullMQ queue state (background jobs)
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * RedisService provides a singleton Redis client instance.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Called when the module is initialized.
   * Establishes connection to Redis.
   */
  async onModuleInit(): Promise<void> {
    try {
      // Get Redis URL from environment, fallback to host/port
      const redisUrl = this.configService.get<string>('REDIS_URL');
      const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
      const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
      const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

      // Initialize Redis client
      if (redisUrl) {
        this.client = new Redis(redisUrl, {
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3,
        });
      } else {
        this.client = new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPassword,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3,
        });
      }

      // Listen for connection events
      this.client.on('connect', () => {
        this.logger.log('Connected to Redis');
      });

      this.client.on('error', (error) => {
        this.logger.error('Redis connection error', error);
      });

      // Test connection
      await this.client.ping();
      this.logger.log('Redis connection established');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
      // In development, allow app to start even if Redis is unavailable
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }

  /**
   * Called when the module is destroyed (application shutdown).
   * Closes the Redis connection gracefully.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        this.logger.log('Disconnected from Redis');
      } catch (error) {
        this.logger.error('Error disconnecting from Redis', error);
      }
    }
  }

  /**
   * Get the Redis client instance.
   * Use this to perform Redis operations (get, set, del, etc.).
   */
  getClient(): Redis | null {
    return this.client || null;
  }

  /**
   * Health check method to verify Redis connection.
   */
  async isHealthy(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

