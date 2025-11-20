/**
 * Returns Service
 *
 * This service contains the business logic for return/RMA operations.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { ReturnsRepository, ReturnWithItems } from './returns.repository';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import { ReturnResponseDto, ReturnItemResponseDto } from './dto/return-response.dto';
import { ReturnStatus, ReturnReason } from '@prisma/client';
import { Logger } from '../../lib/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * ReturnsService handles business logic for return operations
 */
@Injectable()
export class ReturnsService {
  constructor(
    private readonly returnsRepository: ReturnsRepository,
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  /**
   * Get all returns with pagination and optional filtering.
   *
   * @param userId - Optional user ID to filter by
   * @param orderId - Optional order ID to filter by
   * @param status - Optional status to filter by
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated list of returns
   */
  async findAll(
    userId?: string,
    orderId?: string,
    status?: ReturnStatus,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: ReturnResponseDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;
    const [returns, total] = await Promise.all([
      this.returnsRepository.findAll(userId, orderId, status, skip, limit),
      this.returnsRepository.count({
        ...(userId ? { userId } : {}),
        ...(orderId ? { orderId } : {}),
        ...(status ? { status } : {}),
      }),
    ]);

    return {
      data: returns.map((ret) => this.mapToResponseDto(ret)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single return by ID.
   *
   * @param id - Return UUID
   * @param userId - Optional user ID for authorization check
   * @returns Return
   * @throws NotFoundException if return not found
   * @throws ForbiddenException if user doesn't own the return
   */
  async findOne(id: string, userId?: string): Promise<ReturnResponseDto> {
    const return_ = await this.returnsRepository.findById(id);

    if (!return_) {
      throw new NotFoundException(`Return with ID ${id} not found`);
    }

    // Check authorization (user can only view their own returns unless admin)
    if (userId && return_.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view this return');
    }

    return this.mapToResponseDto(return_);
  }

  /**
   * Get a return by return number (RMA number).
   *
   * @param returnNumber - Return number
   * @param userId - Optional user ID for authorization check
   * @returns Return
   * @throws NotFoundException if return not found
   */
  async findByReturnNumber(returnNumber: string, userId?: string): Promise<ReturnResponseDto> {
    const return_ = await this.returnsRepository.findByReturnNumber(returnNumber);

    if (!return_) {
      throw new NotFoundException(`Return with number ${returnNumber} not found`);
    }

    // Check authorization
    if (userId && return_.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view this return');
    }

    return this.mapToResponseDto(return_);
  }

  /**
   * Create a new return (RMA).
   *
   * @param createReturnDto - Return creation data
   * @returns Created return
   * @throws NotFoundException if order or order items not found
   * @throws BadRequestException if return is invalid
   */
  async create(createReturnDto: CreateReturnDto): Promise<ReturnResponseDto> {
    // Validate order exists and belongs to user
    const order = await this.prisma.order.findUnique({
      where: { id: createReturnDto.orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${createReturnDto.orderId} not found`);
    }

    if (order.userId !== createReturnDto.userId) {
      throw new ForbiddenException('You do not have permission to return items from this order');
    }

    // Validate order items exist and belong to order
    const orderItemIds = createReturnDto.items.map((item) => item.orderItemId);
    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        id: { in: orderItemIds },
        orderId: createReturnDto.orderId,
      },
      include: {
        variant: true,
      },
    });

    if (orderItems.length !== orderItemIds.length) {
      throw new BadRequestException('One or more order items not found or do not belong to this order');
    }

    // Validate return quantities don't exceed order quantities
    const orderItemMap = new Map(orderItems.map((item) => [item.id, item]));
    for (const returnItem of createReturnDto.items) {
      const orderItem = orderItemMap.get(returnItem.orderItemId);
      if (!orderItem) {
        throw new BadRequestException(`Order item ${returnItem.orderItemId} not found`);
      }

      if (returnItem.quantity > orderItem.quantity) {
        throw new BadRequestException(
          `Return quantity (${returnItem.quantity}) exceeds order quantity (${orderItem.quantity}) for item ${returnItem.orderItemId}`,
        );
      }
    }

    // Check for existing returns for these order items
    const existingReturns = await this.prisma.returnItem.findMany({
      where: {
        orderItemId: { in: orderItemIds },
      },
      include: {
        return: true,
      },
    });

    // Check if any items are already being returned
    for (const returnItem of createReturnDto.items) {
      const existing = existingReturns.filter(
        (er) => er.orderItemId === returnItem.orderItemId && er.return.status !== ReturnStatus.CANCELLED,
      );
      const alreadyReturnedQty = existing.reduce((sum, er) => sum + er.quantity, 0);
      const orderItem = orderItemMap.get(returnItem.orderItemId)!;
      const remainingQty = orderItem.quantity - alreadyReturnedQty;

      if (returnItem.quantity > remainingQty) {
        throw new BadRequestException(
          `Cannot return ${returnItem.quantity} items. Only ${remainingQty} items remaining for return from order item ${returnItem.orderItemId}`,
        );
      }
    }

    // Generate return number
    const returnNumber = await this.returnsRepository.generateReturnNumber();

    // Create map of orderItemId to variantId
    const orderItemVariantMap = new Map<string, string>();
    for (const orderItem of orderItems) {
      orderItemVariantMap.set(orderItem.id, orderItem.variantId);
    }

    // Create return with items
    const return_ = await this.returnsRepository.create(
      createReturnDto,
      returnNumber,
      orderItemVariantMap,
    );

    this.logger.log(`Return created: ${return_.id} (${returnNumber})`, 'ReturnsService');

    return this.mapToResponseDto(completeReturn);
  }

  /**
   * Update return status (admin only).
   *
   * @param id - Return UUID
   * @param updateReturnDto - Return update data
   * @returns Updated return
   * @throws NotFoundException if return not found
   * @throws BadRequestException if status transition is invalid
   */
  async update(id: string, updateReturnDto: UpdateReturnDto): Promise<ReturnResponseDto> {
    const existing = await this.returnsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Return with ID ${id} not found`);
    }

    // Validate status transitions
    if (updateReturnDto.status) {
      const validTransitions = this.getValidStatusTransitions(existing.status);
      if (!validTransitions.includes(updateReturnDto.status)) {
        throw new BadRequestException(
          `Invalid status transition: ${existing.status} → ${updateReturnDto.status}`,
        );
      }
    }

    const updated = await this.returnsRepository.update(id, updateReturnDto);
    this.logger.log(`Return updated: ${id} (status: ${updateReturnDto.status || existing.status})`, 'ReturnsService');

    return this.mapToResponseDto(updated);
  }

  /**
   * Cancel a return (user can cancel if status is REQUESTED).
   *
   * @param id - Return UUID
   * @param userId - User ID requesting cancellation
   * @returns Updated return
   * @throws NotFoundException if return not found
   * @throws ForbiddenException if user doesn't own the return
   * @throws BadRequestException if return cannot be cancelled
   */
  async cancel(id: string, userId: string): Promise<ReturnResponseDto> {
    const existing = await this.returnsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Return with ID ${id} not found`);
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('You do not have permission to cancel this return');
    }

    if (existing.status !== ReturnStatus.REQUESTED) {
      throw new BadRequestException(`Cannot cancel return in status: ${existing.status}`);
    }

    const updated = await this.returnsRepository.update(id, {
      status: ReturnStatus.CANCELLED,
    });

    this.logger.log(`Return cancelled: ${id}`, 'ReturnsService');

    return this.mapToResponseDto(updated);
  }

  /**
   * Get valid status transitions for a return status.
   *
   * @param currentStatus - Current return status
   * @returns Array of valid next statuses
   */
  private getValidStatusTransitions(currentStatus: ReturnStatus): ReturnStatus[] {
    const transitions: Record<ReturnStatus, ReturnStatus[]> = {
      [ReturnStatus.REQUESTED]: [ReturnStatus.APPROVED, ReturnStatus.REJECTED, ReturnStatus.CANCELLED],
      [ReturnStatus.APPROVED]: [ReturnStatus.PROCESSING, ReturnStatus.CANCELLED],
      [ReturnStatus.REJECTED]: [], // Terminal state
      [ReturnStatus.PROCESSING]: [ReturnStatus.REFUNDED],
      [ReturnStatus.REFUNDED]: [ReturnStatus.COMPLETED],
      [ReturnStatus.COMPLETED]: [], // Terminal state
      [ReturnStatus.CANCELLED]: [], // Terminal state
    };

    return transitions[currentStatus] || [];
  }

  /**
   * Map return entity to response DTO.
   *
   * @param return_ - Return entity with items
   * @returns Return response DTO
   */
  private mapToResponseDto(return_: ReturnWithItems): ReturnResponseDto {
    return {
      id: return_.id,
      orderId: return_.orderId,
      userId: return_.userId,
      returnNumber: return_.returnNumber,
      status: return_.status,
      reason: return_.reason,
      reasonDetails: return_.reasonDetails,
      refundAmount: return_.refundAmount ? Number(return_.refundAmount) : null,
      notes: return_.notes,
      items: return_.items.map((item) => ({
        id: item.id,
        returnId: item.returnId,
        orderItemId: item.orderItemId,
        variantId: item.variantId,
        quantity: item.quantity,
        reason: item.reason,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      createdAt: return_.createdAt,
      updatedAt: return_.updatedAt,
    };
  }
}

