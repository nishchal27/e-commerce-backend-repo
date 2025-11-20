/**
 * Size Charts Controller
 *
 * This controller handles HTTP requests for size chart-related endpoints.
 *
 * Endpoints:
 * - GET /size-charts/product/:productId - Get size chart by product ID
 * - GET /size-charts/:id - Get size chart by ID
 * - POST /size-charts - Create size chart (admin only)
 * - PUT /size-charts/:id - Update size chart (admin only)
 * - DELETE /size-charts/:id - Delete size chart (admin only)
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SizeChartsService } from './size-charts.service';
import { CreateSizeChartDto } from './dto/create-size-chart.dto';
import { UpdateSizeChartDto } from './dto/update-size-chart.dto';
import { SizeChartResponseDto } from './dto/size-chart-response.dto';

/**
 * SizeChartsController handles HTTP requests for size chart endpoints
 */
@Controller('size-charts')
export class SizeChartsController {
  constructor(private readonly sizeChartsService: SizeChartsService) {}

  /**
   * GET /size-charts/product/:productId
   * Get size chart by product ID.
   *
   * @param productId - Product UUID
   * @returns Size chart or null
   */
  @Get('product/:productId')
  async findByProductId(@Param('productId') productId: string): Promise<SizeChartResponseDto | null> {
    return this.sizeChartsService.findByProductId(productId);
  }

  /**
   * GET /size-charts/:id
   * Get a single size chart by ID.
   *
   * @param id - Size chart UUID
   * @returns Size chart
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<SizeChartResponseDto> {
    return this.sizeChartsService.findOne(id);
  }

  /**
   * POST /size-charts
   * Create a new size chart.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param createSizeChartDto - Size chart creation data
   * @returns Created size chart
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createSizeChartDto: CreateSizeChartDto): Promise<SizeChartResponseDto> {
    return this.sizeChartsService.create(createSizeChartDto);
  }

  /**
   * PUT /size-charts/:id
   * Update an existing size chart.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Size chart UUID
   * @param updateSizeChartDto - Size chart update data
   * @returns Updated size chart
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateSizeChartDto: UpdateSizeChartDto,
  ): Promise<SizeChartResponseDto> {
    return this.sizeChartsService.update(id, updateSizeChartDto);
  }

  /**
   * DELETE /size-charts/:id
   * Delete a size chart.
   * TODO: Add @UseGuards(JwtAuthGuard, RolesGuard) and @Roles('admin') for admin-only access
   *
   * @param id - Size chart UUID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.sizeChartsService.remove(id);
  }
}

