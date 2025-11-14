/**
 * Inventory Controller
 *
 * This controller handles HTTP requests for inventory-related endpoints.
 * It validates request data, delegates to the service layer, and returns HTTP responses.
 *
 * Endpoints:
 * - POST /inventory/reserve - Reserve inventory (protected)
 * - POST /inventory/commit - Commit reservation (protected)
 * - POST /inventory/release - Release reservation (protected)
 * - GET /inventory/stock/:skuId - Get stock information (protected)
 *
 * Security:
 * - All endpoints require authentication (@UseGuards(JwtAuthGuard))
 * - Some endpoints may require specific roles (admin for stock management)
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { ReserveInventoryDto } from './dto/reserve-inventory.dto';
import { CommitReservationDto } from './dto/commit-reservation.dto';
import { ReleaseReservationDto } from './dto/release-reservation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RequestWithId } from '../../common/middleware/request-id.middleware';
import { Req } from '@nestjs/common';

/**
 * InventoryController handles HTTP requests for inventory endpoints
 */
@Controller('inventory')
@UseGuards(JwtAuthGuard) // All endpoints require authentication
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * POST /inventory/reserve
   * Reserve inventory.
   *
   * This endpoint:
   * - Validates reservation request
   * - Reserves inventory using selected strategy (optimistic/pessimistic)
   * - Emits inventory.reserved event
   *
   * @param reserveDto - Reservation data
   * @param user - Current authenticated user (from JWT)
   * @param req - Request object (for request ID)
   * @returns Reservation result
   */
  @Post('reserve')
  @HttpCode(HttpStatus.CREATED)
  async reserve(
    @Body() reserveDto: ReserveInventoryDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: RequestWithId,
  ) {
    return this.inventoryService.reserve(
      reserveDto,
      user.sub,
      req.requestId,
      req.traceId,
    );
  }

  /**
   * POST /inventory/commit
   * Commit a reservation.
   *
   * This endpoint:
   * - Commits a reservation (marks as CONSUMED)
   * - Used when order is placed and paid
   * - Emits inventory.committed event
   *
   * @param commitDto - Commit reservation data
   * @param req - Request object (for request ID)
   * @returns Success status
   */
  @Post('commit')
  @HttpCode(HttpStatus.OK)
  async commit(
    @Body() commitDto: CommitReservationDto,
    @Req() req: RequestWithId,
  ) {
    return this.inventoryService.commit(commitDto, req.requestId, req.traceId);
  }

  /**
   * POST /inventory/release
   * Release a reservation.
   *
   * This endpoint:
   * - Releases a reservation (marks as RELEASED)
   * - Returns stock to available inventory
   * - Used when cart is abandoned or checkout cancelled
   * - Emits inventory.released event
   *
   * @param releaseDto - Release reservation data
   * @param req - Request object (for request ID)
   * @returns Success status
   */
  @Post('release')
  @HttpCode(HttpStatus.OK)
  async release(
    @Body() releaseDto: ReleaseReservationDto,
    @Req() req: RequestWithId,
  ) {
    return this.inventoryService.release(releaseDto, req.requestId, req.traceId);
  }

  /**
   * GET /inventory/stock/:skuId
   * Get stock information for a product variant.
   *
   * @param skuId - Product variant SKU ID
   * @returns Stock information (available, reserved, total)
   */
  @Get('stock/:skuId')
  async getStock(@Param('skuId') skuId: string) {
    return this.inventoryService.getStock(skuId);
  }
}

