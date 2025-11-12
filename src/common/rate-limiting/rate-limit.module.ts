/**
 * Rate Limit Module
 *
 * This module provides Redis-backed rate limiting functionality for the application.
 * It exports the RateLimitService and RateLimitGuard for use in other modules.
 *
 * Responsibilities:
 * - Configure rate limiting service with Redis connection
 * - Export rate limiting guard for protecting endpoints
 * - Export rate limiting decorator for marking endpoints
 *
 * Integration:
 * - Uses RedisService (global) for Redis connection
 * - Uses ConfigService (global) for configuration
 * - Can be imported in any module that needs rate limiting
 *
 * Usage:
 * ```typescript
 * @Module({
 *   imports: [RateLimitModule],
 *   controllers: [SomeController],
 * })
 * export class SomeModule {}
 *
 * // In controller:
 * @RateLimit({ type: RateLimitType.LOGIN })
 * @UseGuards(RateLimitGuard)
 * @Post('login')
 * async login() { ... }
 * ```
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RateLimitService } from './rate-limit.service';
import { RateLimitGuard } from './rate-limit.guard';

/**
 * RateLimitModule provides rate limiting functionality
 * Marked as Global so it can be used across the application without importing in every module
 */
@Global()
@Module({
  imports: [ConfigModule], // For ConfigService
  providers: [
    // RateLimitService manages rate limiters and provides consume methods
    RateLimitService,
    // RateLimitGuard enforces rate limits on endpoints
    RateLimitGuard,
  ],
  exports: [
    // Export service for direct use if needed
    RateLimitService,
    // Export guard for use in other modules
    RateLimitGuard,
  ],
})
export class RateLimitModule {}

