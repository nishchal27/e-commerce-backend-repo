/**
 * Roles Guard
 *
 * This guard enforces role-based access control (RBAC) by checking if the
 * authenticated user has one of the required roles to access a route.
 *
 * How it works:
 * 1. Gets required roles from @Roles() decorator metadata
 * 2. Gets user's role from request object (set by JwtAuthGuard)
 * 3. Checks if user's role matches one of the required roles
 * 4. If yes, allows access; if no, returns 403 Forbidden
 *
 * Usage:
 * - Must be used after JwtAuthGuard (user must be authenticated first)
 * - Apply @Roles() decorator to specify required roles
 * - Example: @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
 *
 * Security:
 * - Always check roles after authentication (JwtAuthGuard runs first)
 * - If no roles specified, guard allows access (permissive)
 * - If user doesn't have required role, access is denied (403)
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RequestUser } from '../strategies/jwt.strategy';

/**
 * RolesGuard enforces role-based access control
 * Checks if authenticated user has one of the required roles
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * Check if user has required role to access the route
   *
   * This method:
   * 1. Gets required roles from @Roles() decorator
   * 2. Gets user from request (must be authenticated by JwtAuthGuard)
   * 3. Checks if user's role matches one of the required roles
   * 4. Returns true if access allowed, false if denied
   *
   * Note: This guard assumes user is already authenticated.
   * Always use JwtAuthGuard before RolesGuard.
   *
   * @param context - Execution context (contains route handler and request)
   * @returns True if user has required role, throws ForbiddenException if not
   * @throws ForbiddenException if user doesn't have required role
   */
  canActivate(context: ExecutionContext): boolean {
    // Get required roles from @Roles() decorator metadata
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(), // Check handler-level decorator
      context.getClass(), // Check class-level decorator
    ]);

    // If no roles specified, allow access (permissive)
    // Routes without @Roles() are accessible to all authenticated users
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get user from request (set by JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user: RequestUser = request.user;

    // If user is not authenticated (shouldn't happen if JwtAuthGuard is used first)
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user's role matches one of the required roles
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      // User doesn't have required role - deny access
      throw new ForbiddenException('Insufficient permissions');
    }

    // User has required role - allow access
    return true;
  }
}

