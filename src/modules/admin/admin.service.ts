/**
 * Admin Service
 *
 * Business logic for admin operations.
 * Provides system statistics, user management, and administrative functions.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { AuditLogService, AuditAction, AuditResource } from '../../common/audit/audit-log.service';
import { Logger } from '../../lib/logger';
import { UserRole, OrderStatus, PaymentStatus } from '@prisma/client';
import { AdminStatsDto } from './dto/admin-stats.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: Logger,
  ) {}

  /**
   * Get system statistics for admin dashboard
   */
  async getStats(userId: string): Promise<AdminStatsDto> {
    // Get user statistics
    const [totalUsers, usersByRole] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
    ]);

    const usersByRoleMap: Record<string, number> = {};
    usersByRole.forEach((group) => {
      usersByRoleMap[group.role] = group._count;
    });

    // Get order statistics
    const [totalOrders, ordersByStatus, ordersRevenue] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.order.aggregate({
        where: {
          status: OrderStatus.PAID,
        },
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    const ordersByStatusMap: Record<string, number> = {};
    ordersByStatus.forEach((group) => {
      ordersByStatusMap[group.status] = group._count;
    });

    // Get product statistics
    const [totalProducts, lowStockProducts] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.productVariant.count({
        where: {
          stock: {
            lt: 10, // Low stock threshold
          },
        },
      }),
    ]);

    // Get review statistics
    const [totalReviews, pendingReviews] = await Promise.all([
      (this.prisma as any).review.count(),
      (this.prisma as any).review.count({
        where: {
          moderated: false,
        },
      }),
    ]);

    // Get payment statistics
    const [totalPayments, paymentsByStatus, paymentsRevenue] = await Promise.all([
      (this.prisma as any).payment.count(),
      (this.prisma as any).payment.groupBy({
        by: ['status'],
        _count: true,
      }),
      (this.prisma as any).payment.aggregate({
        where: {
          status: PaymentStatus.SUCCEEDED,
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    const paymentsByStatusMap: Record<string, number> = {};
    paymentsByStatus.forEach((group: any) => {
      paymentsByStatusMap[group.status] = group._count;
    });

    // Log admin access
    await this.auditLogService.logAccess(
      userId,
      AuditAction.READ,
      AuditResource.USER,
      true,
    );

    return {
      users: {
        total: totalUsers,
        active: totalUsers, // TODO: Add last login tracking
        byRole: usersByRoleMap,
      },
      orders: {
        total: totalOrders,
        byStatus: ordersByStatusMap,
        revenue: Number(ordersRevenue._sum.totalAmount || 0),
      },
      products: {
        total: totalProducts,
        lowStock: lowStockProducts,
      },
      reviews: {
        total: totalReviews,
        pendingModeration: pendingReviews,
      },
      payments: {
        total: totalPayments,
        byStatus: paymentsByStatusMap,
        revenue: Number(paymentsRevenue._sum?.amount || 0),
      },
    };
  }

  /**
   * Get all users (paginated)
   */
  async getUsers(
    page: number = 1,
    limit: number = 20,
    role?: UserRole,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const where = role ? { role } : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
    };
  }

  /**
   * Update user role
   */
  async updateUserRole(
    userId: string,
    newRole: UserRole,
    adminUserId: string,
    requestId?: string,
    traceId?: string,
  ): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.role === newRole) {
      throw new BadRequestException(`User already has role ${newRole}`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Log audit event
    await this.auditLogService.logSuccess(
      adminUserId,
      AuditAction.UPDATE,
      AuditResource.USER,
      userId,
      {
        field: 'role',
        oldValue: user.role,
        newValue: newRole,
      },
      requestId,
      traceId,
    );

    this.logger.log(
      `User role updated: ${userId} -> ${newRole} by admin ${adminUserId}`,
      'AdminService',
    );

    return updatedUser;
  }

  /**
   * Get all orders (admin view)
   */
  async getOrders(
    page: number = 1,
    limit: number = 20,
    status?: OrderStatus,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((order) => ({
        id: order.id,
        userId: order.userId,
        user: order.user,
        totalAmount: Number(order.totalAmount),
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }
}

