/**
 * Redis Module
 *
 * This module provides Redis client as a global service for:
 * - Caching (product details, frequently accessed data)
 * - Session storage (future use)
 * - BullMQ queue state management (background jobs)
 *
 * Redis is an in-memory data store that provides fast read/write operations.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

/**
 * Global Redis module that provides Redis client throughout the application.
 * Marked as Global so RedisService doesn't need to be imported in every module.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}

