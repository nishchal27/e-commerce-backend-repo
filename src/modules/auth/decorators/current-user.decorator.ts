/**
 * Current User Decorator
 *
 * This decorator extracts the authenticated user from the request object.
 * It's used in controller methods to get the current user without manually
 * accessing req.user.
 *
 * Usage:
 * @Get('me')
 * getProfile(@CurrentUser() user: RequestUser) {
 *   return user;
 * }
 *
 * How it works:
 * - After JwtAuthGuard validates the token, user is attached to request
 * - This decorator extracts req.user and provides it as a parameter
 * - Type-safe: TypeScript knows the user type from RequestUser interface
 *
 * Why needed?
 * - Cleaner controller code (no need to access req.user manually)
 * - Type-safe (TypeScript knows user structure)
 * - Consistent access pattern across controllers
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../strategies/jwt.strategy';

/**
 * CurrentUser decorator - extracts authenticated user from request
 *
 * This decorator should be used in controller methods that require authentication.
 * It extracts the user object that was attached to the request by JwtAuthGuard.
 *
 * The user object contains:
 * - id: User's unique identifier
 * - email: User's email address
 * - role: User's role (CUSTOMER, ADMIN, MANAGER)
 * - name: User's display name (optional)
 * - isEmailVerified: Whether user's email is verified
 *
 * Example:
 * ```typescript
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: RequestUser) {
 *   return { id: user.id, email: user.email };
 * }
 * ```
 *
 * @param data - Optional parameter (not used, but required by decorator signature)
 * @param ctx - Execution context (contains request object)
 * @returns User object from request
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestUser => {
    // Get request object from execution context
    const request = ctx.switchToHttp().getRequest();

    // Return user object attached by JwtAuthGuard
    // This is set by Passport after successful authentication
    return request.user;
  },
);

