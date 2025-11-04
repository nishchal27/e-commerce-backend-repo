/**
 * Roles Decorator
 *
 * This decorator specifies which roles are allowed to access a route.
 * It's used with RolesGuard to enforce role-based access control (RBAC).
 *
 * Usage:
 * @Roles('ADMIN')
 * @Get('admin/users')
 * getUsers() { ... }
 *
 * @Roles('ADMIN', 'MANAGER')
 * @Get('admin/orders')
 * getOrders() { ... }
 *
 * How it works:
 * - The decorator sets metadata with allowed roles
 * - RolesGuard reads this metadata and checks user's role
 * - User must have one of the specified roles to access the route
 *
 * Security:
 * - Roles are checked after authentication (JwtAuthGuard runs first)
 * - If user doesn't have required role, access is denied (403 Forbidden)
 */

import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Metadata key for role-based access control
 * Used by RolesGuard to check which roles are allowed
 */
export const ROLES_KEY = 'roles';

/**
 * Roles decorator - specifies which roles can access a route
 *
 * Apply this decorator along with @UseGuards(JwtAuthGuard, RolesGuard) to
 * restrict access to specific roles.
 *
 * Example:
 * ```typescript
 * @Get('admin/users')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('ADMIN')
 * getUsers() { ... }
 * ```
 *
 * @param roles - Array of roles that are allowed to access this route
 * @returns Decorator that sets role metadata
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

