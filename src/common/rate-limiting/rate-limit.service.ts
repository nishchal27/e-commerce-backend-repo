/**
 * Rate Limit Service
 *
 * This service provides Redis-backed rate limiting functionality using rate-limiter-flexible.
 * It creates and manages rate limiters for different endpoint types and key strategies.
 *
 * Responsibilities:
 * - Create rate limiters with different configurations (per IP, per user, per email, etc.)
 * - Provide methods to consume rate limit attempts
 * - Handle rate limit violations
 * - Support multiple rate limiting strategies (sliding window, fixed window)
 *
 * Rate Limiting Strategies:
 * - Per IP: Limits requests from a specific IP address
 * - Per User: Limits requests from a specific user (requires authentication)
 * - Per Email: Limits requests for a specific email address (for login, password reset)
 * - Per Token: Limits requests for a specific token (for refresh endpoint)
 *
 * Integration:
 * - Uses RedisService (global) for Redis connection
 * - Uses ConfigService for configuration
 * - Uses Logger for structured logging
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { RedisService } from '../../lib/redis/redis.service';

/**
 * Rate limit configuration interface
 * Defines the parameters for a rate limiter
 */
export interface RateLimitConfig {
  points: number; // Maximum number of requests
  duration: number; // Time window in seconds
  blockDuration?: number; // Optional: block duration after limit exceeded (in seconds)
}

/**
 * Rate limit result interface
 * Returned after consuming a rate limit attempt
 */
export interface RateLimitResult {
  allowed: boolean; // Whether the request is allowed
  remaining: number; // Remaining requests in the current window
  resetTime?: Date; // When the rate limit window resets
  msBeforeNext?: number; // Milliseconds before next request is allowed
}

/**
 * RateLimitService provides Redis-backed rate limiting
 */
@Injectable()
export class RateLimitService implements OnModuleInit {
  private readonly logger = new Logger(RateLimitService.name);
  private redisClient: any; // ioredis client from RedisService

  // Pre-configured rate limiters for common use cases
  private loginLimiter: RateLimiterRedis;
  private refreshLimiter: RateLimiterRedis;
  private registerLimiter: RateLimiterRedis;
  private passwordResetLimiter: RateLimiterRedis;
  private emailVerifyLimiter: RateLimiterRedis;
  private generalApiLimiter: RateLimiterRedis;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    // Don't initialize rate limiters here - wait for Redis to be ready
  }

  /**
   * Initialize rate limiters after Redis is connected
   * This ensures Redis is available before creating rate limiters
   */
  async onModuleInit(): Promise<void> {
    // Wait a bit for Redis to connect (if it hasn't already)
    let retries = 10;
    while (retries > 0) {
      this.redisClient = this.redisService.getClient();
      if (this.redisClient) {
        try {
          // Test the connection
          await this.redisClient.ping();
          break;
        } catch (error) {
          // Redis not ready yet, wait and retry
          await new Promise((resolve) => setTimeout(resolve, 100));
          retries--;
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
        retries--;
      }
    }

    if (!this.redisClient) {
      this.logger.warn(
        'Redis client not available after retries. Rate limiting will not work properly.',
        'RateLimitService',
      );
      return;
    }

    // Initialize pre-configured rate limiters now that Redis is ready
    this.initializeRateLimiters();
  }

  /**
   * Initialize all pre-configured rate limiters
   * These are the default rate limiters for auth endpoints
   */
  private initializeRateLimiters(): void {
    // Login rate limiter: 5 requests per minute per IP+Email
    const loginConfig = this.getRateLimitConfig('LOGIN', {
      points: 5,
      duration: 60, // 1 minute
      blockDuration: 900, // Block for 15 minutes after limit exceeded
    });
    this.loginLimiter = this.createRateLimiter('login', loginConfig);

    // Refresh rate limiter: 30 requests per minute per IP+Token
    const refreshConfig = this.getRateLimitConfig('REFRESH', {
      points: 30,
      duration: 60, // 1 minute
    });
    this.refreshLimiter = this.createRateLimiter('refresh', refreshConfig);

    // Register rate limiter: 3 requests per hour per IP
    const registerConfig = this.getRateLimitConfig('REGISTER', {
      points: 3,
      duration: 3600, // 1 hour
    });
    this.registerLimiter = this.createRateLimiter('register', registerConfig);

    // Password reset rate limiter: 3 requests per hour per IP+Email
    const passwordResetConfig = this.getRateLimitConfig('PASSWORD_RESET', {
      points: 3,
      duration: 3600, // 1 hour
    });
    this.passwordResetLimiter = this.createRateLimiter('password-reset', passwordResetConfig);

    // Email verification rate limiter: 5 requests per hour per IP+Email
    const emailVerifyConfig = this.getRateLimitConfig('EMAIL_VERIFY', {
      points: 5,
      duration: 3600, // 1 hour
    });
    this.emailVerifyLimiter = this.createRateLimiter('email-verify', emailVerifyConfig);

    // General API rate limiter: 100 requests per minute per IP
    const generalApiConfig = this.getRateLimitConfig('GENERAL', {
      points: 100,
      duration: 60, // 1 minute
    });
    this.generalApiLimiter = this.createRateLimiter('general-api', generalApiConfig);

    this.logger.log('Rate limiters initialized', 'RateLimitService');
  }

  /**
   * Get rate limit configuration from environment or use defaults
   *
   * @param type - Rate limit type (LOGIN, REFRESH, etc.)
   * @param defaults - Default configuration values
   * @returns Rate limit configuration
   */
  private getRateLimitConfig(
    type: string,
    defaults: RateLimitConfig,
  ): RateLimitConfig {
    const envPrefix = `RATE_LIMIT_${type}_`;
    const points = this.configService.get<number>(
      `${envPrefix}PER_${type === 'LOGIN' || type === 'REFRESH' || type === 'GENERAL' ? 'MIN' : 'HR'}`,
      defaults.points,
    );
    const duration = this.configService.get<number>(
      `${envPrefix}DURATION`,
      defaults.duration,
    );
    const blockDuration = this.configService.get<number>(
      `${envPrefix}BLOCK_DURATION`,
    );

    return {
      points,
      duration,
      blockDuration: blockDuration ?? defaults.blockDuration,
    };
  }

  /**
   * Create a new rate limiter instance
   *
   * @param keyPrefix - Prefix for Redis keys (e.g., 'login', 'refresh')
   * @param config - Rate limit configuration
   * @returns RateLimiterRedis instance
   */
  private createRateLimiter(
    keyPrefix: string,
    config: RateLimitConfig,
  ): RateLimiterRedis {
    return new RateLimiterRedis({
      storeClient: this.redisClient, // Redis client from RedisService
      keyPrefix: `rate_limit:${keyPrefix}:`, // Redis key prefix
      points: config.points, // Maximum number of requests
      duration: config.duration, // Time window in seconds
      blockDuration: config.blockDuration, // Block duration after limit exceeded
      // Use sliding window algorithm for smoother rate limiting
      execEvenly: false, // Don't evenly distribute requests
      // Error handling
      insuranceLimiter: undefined, // No fallback limiter (fail if Redis is down)
    });
  }

  /**
   * Consume rate limit for login endpoint
   * Key: IP address + Email address
   *
   * @param ip - Client IP address
   * @param email - User email address
   * @returns Rate limit result
   */
  async consumeLogin(ip: string, email: string): Promise<RateLimitResult> {
    if (!this.loginLimiter) {
      this.logger.error('Login rate limiter not initialized', 'RateLimitService');
      // Allow request if rate limiter is not available (fail open)
      return {
        allowed: true,
        remaining: 999,
        resetTime: new Date(),
        msBeforeNext: 0,
      };
    }
    const key = `${ip}:${email}`;
    return this.consume(this.loginLimiter, key, 'login');
  }

  /**
   * Consume rate limit for refresh endpoint
   * Key: IP address + Token hash (first 8 chars for uniqueness)
   *
   * @param ip - Client IP address
   * @param tokenHash - Refresh token hash (first 8 characters)
   * @returns Rate limit result
   */
  async consumeRefresh(ip: string, tokenHash: string): Promise<RateLimitResult> {
    // Use first 8 characters of token hash for key (balance between uniqueness and storage)
    const key = `${ip}:${tokenHash.substring(0, 8)}`;
    return this.consume(this.refreshLimiter, key, 'refresh');
  }

  /**
   * Consume rate limit for register endpoint
   * Key: IP address
   *
   * @param ip - Client IP address
   * @returns Rate limit result
   */
  async consumeRegister(ip: string): Promise<RateLimitResult> {
    return this.consume(this.registerLimiter, ip, 'register');
  }

  /**
   * Consume rate limit for password reset endpoint
   * Key: IP address + Email address
   *
   * @param ip - Client IP address
   * @param email - User email address
   * @returns Rate limit result
   */
  async consumePasswordReset(ip: string, email: string): Promise<RateLimitResult> {
    const key = `${ip}:${email}`;
    return this.consume(this.passwordResetLimiter, key, 'password-reset');
  }

  /**
   * Consume rate limit for email verification endpoint
   * Key: IP address + Email address
   *
   * @param ip - Client IP address
   * @param email - User email address
   * @returns Rate limit result
   */
  async consumeEmailVerify(ip: string, email: string): Promise<RateLimitResult> {
    const key = `${ip}:${email}`;
    return this.consume(this.emailVerifyLimiter, key, 'email-verify');
  }

  /**
   * Consume rate limit for general API endpoints
   * Key: IP address
   *
   * @param ip - Client IP address
   * @returns Rate limit result
   */
  async consumeGeneralApi(ip: string): Promise<RateLimitResult> {
    return this.consume(this.generalApiLimiter, ip, 'general-api');
  }

  /**
   * Consume a rate limit attempt
   * This is the core method that checks and decrements the rate limit counter
   *
   * @param limiter - Rate limiter instance
   * @param key - Unique key for this rate limit (e.g., IP, IP+Email, etc.)
   * @param type - Rate limit type (for logging)
   * @returns Rate limit result
   */
  private async consume(
    limiter: RateLimiterRedis,
    key: string,
    type: string,
  ): Promise<RateLimitResult> {
    try {
      // Consume one point from the rate limiter
      // If limit is exceeded, this will throw an error
      const rateLimiterRes: RateLimiterRes = await limiter.consume(key);

      // Request is allowed
      return {
        allowed: true,
        remaining: rateLimiterRes.remainingPoints,
        resetTime: new Date(Date.now() + rateLimiterRes.msBeforeNext),
        msBeforeNext: rateLimiterRes.msBeforeNext,
      };
    } catch (rateLimiterRes: any) {
      // Rate limit exceeded
      // rate-limiter-flexible throws an error when limit is exceeded
      // The error object contains rate limit information
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + rateLimiterRes.msBeforeNext),
        msBeforeNext: rateLimiterRes.msBeforeNext,
      };

      this.logger.warn(
        `Rate limit exceeded for ${type} (key: ${key}). Remaining: ${result.remaining}, Reset in: ${result.msBeforeNext}ms`,
        'RateLimitService',
      );

      return result;
    }
  }

  /**
   * Create a custom rate limiter with specific configuration
   * Useful for creating rate limiters for specific endpoints or use cases
   *
   * @param keyPrefix - Prefix for Redis keys
   * @param config - Rate limit configuration
   * @returns RateLimiterRedis instance
   */
  createCustomLimiter(
    keyPrefix: string,
    config: RateLimitConfig,
  ): RateLimiterRedis {
    return this.createRateLimiter(keyPrefix, config);
  }

  /**
   * Clear rate limit for a specific key
   * Useful for development/testing or manual reset
   *
   * @param type - Rate limit type (LOGIN, REFRESH, etc.)
   * @param key - Rate limit key (e.g., IP, IP+Email, etc.)
   * @returns Promise that resolves when the key is deleted
   */
  async clearRateLimit(type: string, key: string): Promise<void> {
    if (!this.redisClient) {
      this.logger.warn('Redis client not available. Cannot clear rate limit.', 'RateLimitService');
      return;
    }

    try {
      // Get the appropriate limiter based on type
      let limiter: RateLimiterRedis;
      switch (type) {
        case 'login':
          limiter = this.loginLimiter;
          break;
        case 'refresh':
          limiter = this.refreshLimiter;
          break;
        case 'register':
          limiter = this.registerLimiter;
          break;
        case 'password-reset':
          limiter = this.passwordResetLimiter;
          break;
        case 'email-verify':
          limiter = this.emailVerifyLimiter;
          break;
        case 'general-api':
          limiter = this.generalApiLimiter;
          break;
        default:
          this.logger.warn(`Unknown rate limit type: ${type}`, 'RateLimitService');
          return;
      }

      if (!limiter) {
        this.logger.warn(`Rate limiter for ${type} not initialized`, 'RateLimitService');
        // Try to delete directly from Redis using the key pattern
        const keyPattern = `rate_limit:${type}:${key}*`;
        const keys = await this.redisClient.keys(keyPattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
          this.logger.log(`Cleared ${keys.length} rate limit key(s) for ${type} (pattern: ${keyPattern})`, 'RateLimitService');
        } else {
          this.logger.warn(`No rate limit keys found for pattern: ${keyPattern}`, 'RateLimitService');
        }
        return;
      }

      // Delete the rate limit key from Redis using the limiter's delete method
      await limiter.delete(key);
      this.logger.log(`Cleared rate limit for ${type} (key: ${key})`, 'RateLimitService');
    } catch (error) {
      this.logger.error(`Failed to clear rate limit: ${error.message}`, 'RateLimitService');
      // Try direct Redis deletion as fallback
      try {
        const keyPattern = `rate_limit:${type}:${key}*`;
        const keys = await this.redisClient.keys(keyPattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
          this.logger.log(`Cleared ${keys.length} rate limit key(s) via fallback method`, 'RateLimitService');
        }
      } catch (fallbackError) {
        this.logger.error(`Fallback deletion also failed: ${fallbackError.message}`, 'RateLimitService');
      }
      throw error;
    }
  }

  /**
   * Clear login rate limit for a specific IP and email
   * Convenience method for clearing login rate limits
   *
   * @param ip - Client IP address
   * @param email - User email address
   * @returns Promise that resolves when the key is deleted
   */
  async clearLoginRateLimit(ip: string, email: string): Promise<void> {
    const key = `${ip}:${email}`;
    return this.clearRateLimit('login', key);
  }

  /**
   * Clear all rate limits for a specific type
   * Useful for development/testing
   *
   * @param type - Rate limit type (login, refresh, etc.)
   * @returns Number of keys deleted
   */
  async clearAllRateLimits(type: string): Promise<number> {
    if (!this.redisClient) {
      this.logger.warn('Redis client not available. Cannot clear rate limits.', 'RateLimitService');
      return 0;
    }

    try {
      // Find all keys matching the rate limit pattern for this type
      const keyPattern = `rate_limit:${type}:*`;
      const keys = await this.redisClient.keys(keyPattern);
      
      if (keys.length === 0) {
        this.logger.log(`No rate limit keys found for type: ${type}`, 'RateLimitService');
        return 0;
      }

      // Delete all matching keys
      await this.redisClient.del(...keys);
      this.logger.log(`Cleared ${keys.length} rate limit key(s) for type: ${type}`, 'RateLimitService');
      return keys.length;
    } catch (error) {
      this.logger.error(`Failed to clear all rate limits for ${type}: ${error.message}`, 'RateLimitService');
      throw error;
    }
  }
}

