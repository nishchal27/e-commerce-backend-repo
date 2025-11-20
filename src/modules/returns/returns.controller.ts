/**
 * Returns Controller
 *
 * This controller handles HTTP requests for return/RMA-related endpoints.
 *
 * Endpoints:
 * - GET /returns - List all returns (with filters)
 * - GET /returns/:id - Get return by ID
 * - GET /returns/number/:returnNumber - Get return by return number
 * - POST /returns - Create return (customer)
 * - PATCH /returns/:id - Update return status (admin)
 * - POST /returns/:id/cancel - Cancel return (customer)
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnDto } from './dto/update-return.dto';
import { ReturnResponseDto } from './dto/return-response.dto';
import { ReturnStatus } from '@prisma/client';
// TODO: Import JwtAuthGuard when auth is set up
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * ReturnsController handles HTTP requests for return endpoints
 */
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  /**
   * GET /returns
   * Get all returns with pagination and optional filtering.
   *
   * Query parameters:
   * - userId: Filter by user ID
   * - orderId: Filter by order ID
   * - status: Filter by return status
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 20)
   *
   * @returns Paginated list of returns
   */
  @Get()
  // TODO: Add @UseGuards(JwtAuthGuard) for authentication
  async findAll(
    @Query('userId') userId?: string,
    @Query('orderId') orderId?: string,
    @Query('status') status?: ReturnStatus,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    return this.returnsService.findAll(userId, orderId, status, page, limit);
  }

  /**
   * GET /returns/:id
   * Get a single return by ID.
   *
   * @param id - Return UUID
   * @returns Return
   */
  @Get(':id')
  // TODO: Add @UseGuards(JwtAuthGuard) and @CurrentUser() for authorization
  async findOne(@Param('id') id: string): Promise<ReturnResponseDto> {
    // TODO: Get userId from @CurrentUser() decorator
    return this.returnsService.findOne(id, undefined);
  }

  /**
   * GET /returns/number/:returnNumber
   * Get a return by return number (RMA number).
   *
   * @param returnNumber - Return number (e.g., "RMA-2024-001")
   * @returns Return
   */
  @Get('number/:returnNumber')
  // TODO: Add @UseGuards(JwtAuthGuard) and @CurrentUser() for authorization
  async findByReturnNumber(@Param('returnNumber') returnNumber: string): Promise<ReturnResponseDto> {
    // TODO: Get userId from @CurrentUser() decorator
    return this.returnsService.findByReturnNumber(returnNumber, undefined);
  }

  /**
   * POST /returns
   * Create a new return (RMA).
   * TODO: Add @UseGuards(JwtAuthGuard) and @CurrentUser() for authentication
   *
   * @param createReturnDto - Return creation data
   * @returns Created return
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createReturnDto: CreateReturnDto): Promise<ReturnResponseDto> {
    // TODO: Get userId from @CurrentUser() decorator instead of DTO
    return this.returnsService.create(createReturnDto);
  }

  /**
   * PATCH /returns/:id
   * Update return status (admin only).
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Return UUID
   * @param updateReturnDto - Return update data
   * @returns Updated return
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateReturnDto: UpdateReturnDto,
  ): Promise<ReturnResponseDto> {
    return this.returnsService.update(id, updateReturnDto);
  }

  /**
   * POST /returns/:id/cancel
   * Cancel a return (customer can cancel if status is REQUESTED).
   * TODO: Add @UseGuards(JwtAuthGuard) and @CurrentUser() for authentication
   *
   * @param id - Return UUID
   * @returns Updated return
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string): Promise<ReturnResponseDto> {
    // TODO: Get userId from @CurrentUser() decorator
    throw new BadRequestException('User ID required for cancellation');
    // return this.returnsService.cancel(id, userId);
  }
}

