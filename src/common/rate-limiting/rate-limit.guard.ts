/**
 * Rate Limit Guard
 *
 * This guard enforces rate limiting on endpoints marked with the @RateLimit() decorator.
 * It intercepts requests, checks rate limits, and throws an exception if the limit is exceeded.
 *
 * How it works:
 * 1. Checks if the route has @RateLimit() decorator
 * 2. Extracts rate limit configuration from metadata
 * 3. Generates rate limit key (IP, IP+Email, IP+Token, etc.)
 * 4. Consumes rate limit attempt using RateLimitService
 * 5. If limit exceeded, throws TooManyRequestsException
 * 6. If allowed, adds rate limit headers to response and continues
 *
 * Security:
 * - Uses Redis-backed rate limiting (distributed, consistent across instances)
 * - Supports multiple key strategies (IP, IP+Email, IP+Token)
 * - Prevents brute force attacks and API abuse
 * - Returns 429 Too Many Requests when limit exceeded
 *
 * Integration:
 * - Works with @RateLimit() decorator
 * - Uses RateLimitService for rate limit checks
 * - Adds rate limit headers to responses (X-RateLimit-*)
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RateLimitService } from './rate-limit.service';
import {
  RateLimitOptions,
  RateLimitType,
  RATE_LIMIT_KEY,
} from './decorators/rate-limit.decorator';
import { PrometheusService } from '../prometheus/prometheus.service';

/**
 * RateLimitGuard enforces rate limiting on protected endpoints
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
    private readonly prometheusService: PrometheusService,
  ) {}

  /**
   * Determines if the request should be allowed based on rate limits
   *
   * @param context - Execution context (contains request, response, etc.)
   * @returns True if request is allowed, throws exception if rate limit exceeded
   * @throws HttpException (429 Too Many Requests) if rate limit exceeded
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get rate limit configuration from route metadata
    const rateLimitOptions = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no rate limit configuration, allow request (no rate limiting)
    if (!rateLimitOptions) {
      return true;
    }

    // Get request and response objects
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Generate rate limit key based on type and request
    const key = this.generateKey(rateLimitOptions, request);

    // Consume rate limit attempt
    const result = await this.consumeRateLimit(rateLimitOptions.type, key, request);

    // Add rate limit headers to response
    this.addRateLimitHeaders(response, result);

    // If rate limit exceeded, throw exception
    if (!result.allowed) {
      // Get endpoint path for metrics
      const endpoint = request.route?.path || request.path || 'unknown';
      const rateLimitType = rateLimitOptions.type;

      // Record rate limit block metric
      this.prometheusService.recordRateLimitBlock(endpoint, rateLimitType);

      const retryAfter = Math.ceil((result.msBeforeNext || 0) / 1000); // Convert to seconds
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter, // Seconds until retry is allowed
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Request is allowed
    return true;
  }

  /**
   * Generate rate limit key based on configuration and request
   *
   * @param options - Rate limit configuration
   * @param request - Express request object
   * @returns Rate limit key string
   */
  private generateKey(options: RateLimitOptions, request: Request): string {
    // If custom key generator provided, use it
    if (options.keyGenerator) {
      return options.keyGenerator(request);
    }

    // Get client IP address
    const ip = this.getClientIp(request);

    // Generate key based on rate limit type
    switch (options.type) {
      case RateLimitType.LOGIN:
        // Login: IP + Email
        const loginEmail = request.body?.email || '';
        return `${ip}:${loginEmail}`;

      case RateLimitType.REFRESH:
        // Refresh: IP + Token hash (from cookie)
        const refreshToken = request.cookies?.refreshToken || '';
        // Use first 8 characters of token for key (balance between uniqueness and storage)
        const tokenHash = refreshToken.substring(0, 8);
        return `${ip}:${tokenHash}`;

      case RateLimitType.REGISTER:
        // Register: IP only
        return ip;

      case RateLimitType.PASSWORD_RESET:
        // Password reset: IP + Email
        const resetEmail = request.body?.email || '';
        return `${ip}:${resetEmail}`;

      case RateLimitType.EMAIL_VERIFY:
        // Email verify: IP + Email (from body or query)
        const verifyEmail = request.body?.email || request.query?.email || '';
        return `${ip}:${verifyEmail}`;

      case RateLimitType.GENERAL_API:
        // General API: IP only
        return ip;

      default:
        // Default: IP only
        return ip;
    }
  }

  /**
   * Consume rate limit attempt based on type
   *
   * @param type - Rate limit type
   * @param key - Rate limit key
   * @param request - Express request object
   * @returns Rate limit result
   */
  private async consumeRateLimit(
    type: RateLimitType,
    key: string,
    request: Request,
  ) {
    const ip = this.getClientIp(request);

    switch (type) {
      case RateLimitType.LOGIN:
        const loginEmail = request.body?.email || '';
        return this.rateLimitService.consumeLogin(ip, loginEmail);

      case RateLimitType.REFRESH:
        const refreshToken = request.cookies?.refreshToken || '';
        return this.rateLimitService.consumeRefresh(ip, refreshToken);

      case RateLimitType.REGISTER:
        return this.rateLimitService.consumeRegister(ip);

      case RateLimitType.PASSWORD_RESET:
        const resetEmail = request.body?.email || '';
        return this.rateLimitService.consumePasswordReset(ip, resetEmail);

      case RateLimitType.EMAIL_VERIFY:
        const verifyEmail = request.body?.email || request.query?.email || '';
        return this.rateLimitService.consumeEmailVerify(ip, verifyEmail);

      case RateLimitType.GENERAL_API:
        return this.rateLimitService.consumeGeneralApi(ip);

      default:
        // Default to general API rate limit
        return this.rateLimitService.consumeGeneralApi(ip);
    }
  }

  /**
   * Get client IP address from request
   * Handles proxies and load balancers (X-Forwarded-For header)
   *
   * @param request - Express request object
   * @returns Client IP address
   */
  private getClientIp(request: Request): string {
    // Check X-Forwarded-For header (for proxies/load balancers)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs (comma-separated)
      // The first IP is the original client IP
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }

    // Check X-Real-IP header (alternative header for client IP)
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fallback to request connection remote address
    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  /**
   * Add rate limit headers to response
   * These headers inform the client about rate limit status
   *
   * @param response - Express response object
   * @param result - Rate limit result
   */
  private addRateLimitHeaders(response: Response, result: any): void {
    // X-RateLimit-Limit: Maximum number of requests allowed
    // X-RateLimit-Remaining: Number of requests remaining in current window
    // X-RateLimit-Reset: Unix timestamp when rate limit window resets
    // Retry-After: Seconds until retry is allowed (only if limit exceeded)

    if (result.resetTime) {
      const resetTimestamp = Math.floor(result.resetTime.getTime() / 1000);
      response.setHeader('X-RateLimit-Reset', resetTimestamp);
    }

    if (result.remaining !== undefined) {
      response.setHeader('X-RateLimit-Remaining', result.remaining);
    }

    if (!result.allowed && result.msBeforeNext) {
      const retryAfter = Math.ceil(result.msBeforeNext / 1000);
      response.setHeader('Retry-After', retryAfter);
    }
  }
}

