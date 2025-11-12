/**
 * Rate Limit Decorator
 *
 * This decorator is used to specify rate limiting configuration for endpoints.
 * It works in conjunction with the RateLimitGuard to enforce rate limits.
 *
 * Usage:
 * ```typescript
 * @RateLimit({ type: 'login' })
 * @Post('login')
 * async login(@Body() loginDto: LoginDto) { ... }
 * ```
 *
 * The decorator sets metadata that the RateLimitGuard reads to determine
 * which rate limiter to use and how to construct the rate limit key.
 */

import { SetMetadata } from '@nestjs/common';

/**
 * Rate limit type enum
 * Defines the different types of rate limiters available
 */
export enum RateLimitType {
  LOGIN = 'login', // Login endpoint (IP + Email)
  REFRESH = 'refresh', // Refresh endpoint (IP + Token)
  REGISTER = 'register', // Register endpoint (IP)
  PASSWORD_RESET = 'password-reset', // Password reset endpoint (IP + Email)
  EMAIL_VERIFY = 'email-verify', // Email verification endpoint (IP + Email)
  GENERAL_API = 'general-api', // General API endpoint (IP)
}

/**
 * Rate limit configuration for decorator
 */
export interface RateLimitOptions {
  /**
   * Type of rate limiter to use
   * Each type has a pre-configured rate limit (points, duration)
   */
  type: RateLimitType;

  /**
   * Optional: Custom key generator function
   * If provided, this function will be used to generate the rate limit key
   * instead of the default key generation logic
   *
   * @param request - Express request object
   * @returns Rate limit key string
   */
  keyGenerator?: (request: any) => string;
}

/**
 * Metadata key for rate limit configuration
 */
export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * Decorator to specify rate limiting for an endpoint
 *
 * @param options - Rate limit configuration
 * @returns Method decorator
 *
 * Example:
 * ```typescript
 * @RateLimit({ type: RateLimitType.LOGIN })
 * @Post('login')
 * async login(@Body() loginDto: LoginDto) { ... }
 * ```
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

