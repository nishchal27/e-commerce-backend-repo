/**
 * JWT Authentication Guard
 *
 * This guard protects routes by requiring a valid JWT access token.
 * It's the primary authentication mechanism for the application.
 *
 * How it works:
 * 1. Checks if route is marked as @Public() - if yes, allows access
 * 2. Extracts JWT token from Authorization header
 * 3. Uses JwtStrategy to validate token
 * 4. If valid, attaches user to request object
 * 5. If invalid, returns 401 Unauthorized
 *
 * Usage:
 * - Apply globally to protect all routes by default
 * - Use @Public() decorator to exclude specific routes
 * - User data available via @CurrentUser() decorator after authentication
 *
 * Security:
 * - Routes are protected by default (secure by default principle)
 * - Public routes must be explicitly marked
 * - Invalid/expired tokens are rejected
 */

import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JwtAuthGuard protects routes by requiring valid JWT access tokens
 * Extends AuthGuard with 'jwt' strategy (uses JwtStrategy)
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Check if route should be public (no authentication required)
   *
   * This method is called before authentication. If the route is marked
   * with @Public(), authentication is skipped and access is allowed.
   *
   * Why override canActivate?
   * - We want to check for @Public() decorator before attempting authentication
   * - This prevents unnecessary token validation for public routes
   * - Improves performance and user experience
   *
   * @param context - Execution context (contains route handler metadata)
   * @returns True if route is public or authentication succeeds
   */
  canActivate(context: ExecutionContext) {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // Check handler-level decorator
      context.getClass(), // Check class-level decorator
    ]);

    // If route is public, allow access without authentication
    if (isPublic) {
      return true;
    }

    // Otherwise, proceed with normal JWT authentication
    // This calls JwtStrategy.validate() which validates the token
    return super.canActivate(context);
  }
}

