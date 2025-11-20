/**
 * Promotions Controller
 *
 * This controller handles HTTP requests for promotion-related endpoints.
 *
 * Endpoints:
 * - GET /promotions - List all promotions
 * - GET /promotions/:id - Get promotion by ID
 * - GET /promotions/code/:code - Get promotion by code
 * - POST /promotions/validate - Validate promotion code
 * - POST /promotions - Create promotion (admin only)
 * - PUT /promotions/:id - Update promotion (admin only)
 * - DELETE /promotions/:id - Delete promotion (admin only)
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseBoolPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { ValidatePromotionDto } from './dto/validate-promotion.dto';
import { PromotionResponseDto } from './dto/promotion-response.dto';

/**
 * PromotionsController handles HTTP requests for promotion endpoints
 */
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  /**
   * GET /promotions
   * Get all promotions.
   *
   * Query parameters:
   * - includeInactive: Include inactive promotions (default: false)
   * - activeOnly: Only return currently active promotions (within date range) (default: false)
   *
   * @returns Array of promotions
   */
  @Get()
  async findAll(
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
    @Query('activeOnly', new DefaultValuePipe(false), ParseBoolPipe) activeOnly: boolean,
  ): Promise<PromotionResponseDto[]> {
    return this.promotionsService.findAll(includeInactive, activeOnly);
  }

  /**
   * GET /promotions/:id
   * Get a single promotion by ID.
   *
   * @param id - Promotion UUID
   * @returns Promotion
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PromotionResponseDto> {
    return this.promotionsService.findOne(id);
  }

  /**
   * GET /promotions/code/:code
   * Get a promotion by code.
   *
   * @param code - Promotion code
   * @returns Promotion
   */
  @Get('code/:code')
  async findByCode(@Param('code') code: string): Promise<PromotionResponseDto> {
    return this.promotionsService.findByCode(code);
  }

  /**
   * POST /promotions/validate
   * Validate a promotion code and calculate discount.
   *
   * @param validateDto - Validation data
   * @returns Promotion with calculated discount
   */
  @Post('validate')
  async validate(@Body() validateDto: ValidatePromotionDto): Promise<PromotionResponseDto> {
    return this.promotionsService.validatePromotion(validateDto);
  }

  /**
   * POST /promotions
   * Create a new promotion.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param createPromotionDto - Promotion creation data
   * @returns Created promotion
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createPromotionDto: CreatePromotionDto): Promise<PromotionResponseDto> {
    return this.promotionsService.create(createPromotionDto);
  }

  /**
   * PUT /promotions/:id
   * Update an existing promotion.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Promotion UUID
   * @param updatePromotionDto - Promotion update data
   * @returns Updated promotion
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePromotionDto: UpdatePromotionDto,
  ): Promise<PromotionResponseDto> {
    return this.promotionsService.update(id, updatePromotionDto);
  }

  /**
   * DELETE /promotions/:id
   * Delete a promotion (soft delete).
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Promotion UUID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.promotionsService.remove(id);
  }
}

