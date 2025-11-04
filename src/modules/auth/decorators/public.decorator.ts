/**
 * Public Decorator
 *
 * This decorator marks routes as public (no authentication required).
 * It's used to exclude certain routes from the global JWT authentication guard.
 *
 * Usage:
 * @Public()
 * @Get('login')
 * login() { ... }
 *
 * How it works:
 * - The decorator sets metadata on the route handler
 * - JwtAuthGuard checks this metadata before enforcing authentication
 * - Routes without @Public() require authentication by default
 *
 * Why needed?
 * - By default, we want all routes protected (secure by default)
 * - Public routes (login, register) need explicit opt-out
 * - This follows the "deny by default" security principle
 */

import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for public routes
 * Used by JwtAuthGuard to check if route should be public
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Public decorator - marks a route as public (no authentication required)
 *
 * Apply this decorator to routes that should be accessible without authentication:
 * - Login, register, password reset
 * - Public information endpoints
 * - Health checks
 *
 * @returns Decorator that sets public route metadata
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

