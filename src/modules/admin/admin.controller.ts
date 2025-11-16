/**
 * Admin Controller
 *
 * HTTP endpoints for admin operations.
 * All endpoints require ADMIN or MANAGER role.
 */

import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RequestWithId } from '../../common/middleware/request-id.middleware';
import { UserRole, OrderStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * GET /admin/stats
   * Get system statistics for admin dashboard
   */
  @Get('stats')
  async getStats(@CurrentUser() user: JwtPayload) {
    return this.adminService.getStats(user.sub);
  }

  /**
   * GET /admin/users
   * Get all users (paginated)
   */
  @Get('users')
  async getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('role') role?: UserRole,
  ) {
    const maxLimit = 100;
    const actualLimit = Math.min(limit, maxLimit);
    return this.adminService.getUsers(page, actualLimit, role);
  }

  /**
   * PATCH /admin/users/:id/role
   * Update user role (ADMIN only)
   */
  @Patch('users/:id/role')
  @Roles('ADMIN') // Only admins can change roles
  async updateUserRole(
    @Param('id') userId: string,
    @Body('role') newRole: UserRole,
    @CurrentUser() admin: JwtPayload,
    @Req() req: RequestWithId,
  ) {
    return this.adminService.updateUserRole(
      userId,
      newRole,
      admin.sub,
      req.requestId,
      req.traceId,
    );
  }

  /**
   * GET /admin/orders
   * Get all orders (admin view)
   */
  @Get('orders')
  async getOrders(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: OrderStatus,
  ) {
    const maxLimit = 100;
    const actualLimit = Math.min(limit, maxLimit);
    return this.adminService.getOrders(page, actualLimit, status);
  }
}

