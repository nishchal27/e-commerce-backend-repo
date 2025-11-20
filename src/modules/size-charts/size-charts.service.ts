/**
 * Size Charts Service
 *
 * This service contains the business logic for size chart operations.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SizeChartsRepository } from './size-charts.repository';
import { CreateSizeChartDto } from './dto/create-size-chart.dto';
import { UpdateSizeChartDto } from './dto/update-size-chart.dto';
import { SizeChartResponseDto } from './dto/size-chart-response.dto';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { Logger } from '../../lib/logger';

/**
 * SizeChartsService handles business logic for size chart operations
 */
@Injectable()
export class SizeChartsService {
  constructor(
    private readonly sizeChartsRepository: SizeChartsRepository,
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  /**
   * Get size chart by product ID.
   *
   * @param productId - Product UUID
   * @returns Size chart or null if not found
   */
  async findByProductId(productId: string): Promise<SizeChartResponseDto | null> {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const sizeChart = await this.sizeChartsRepository.findByProductId(productId);
    if (!sizeChart) {
      return null;
    }
    return {
      id: sizeChart.id,
      productId: sizeChart.productId,
      name: sizeChart.name,
      measurements: (sizeChart.measurements as Record<string, any>) || {},
      createdAt: sizeChart.createdAt,
      updatedAt: sizeChart.updatedAt,
    };
  }

  /**
   * Get a single size chart by ID.
   *
   * @param id - Size chart UUID
   * @returns Size chart
   * @throws NotFoundException if size chart not found
   */
  async findOne(id: string): Promise<SizeChartResponseDto> {
    const sizeChart = await this.sizeChartsRepository.findById(id);

    if (!sizeChart) {
      throw new NotFoundException(`Size chart with ID ${id} not found`);
    }

    return {
      id: sizeChart.id,
      productId: sizeChart.productId,
      name: sizeChart.name,
      measurements: (sizeChart.measurements as Record<string, any>) || {},
      createdAt: sizeChart.createdAt,
      updatedAt: sizeChart.updatedAt,
    };
  }

  /**
   * Create a new size chart.
   *
   * @param createSizeChartDto - Size chart creation data
   * @returns Created size chart
   * @throws NotFoundException if product not found
   * @throws BadRequestException if size chart already exists for product
   */
  async create(createSizeChartDto: CreateSizeChartDto): Promise<SizeChartResponseDto> {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: createSizeChartDto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${createSizeChartDto.productId} not found`);
    }

    // Check if size chart already exists for this product
    const existing = await this.sizeChartsRepository.findByProductId(createSizeChartDto.productId);
    if (existing) {
      throw new BadRequestException(`Size chart already exists for product ${createSizeChartDto.productId}`);
    }

    // Validate measurements structure
    this.validateMeasurements(createSizeChartDto.measurements);

    const sizeChart = await this.sizeChartsRepository.create(createSizeChartDto);
    this.logger.log(`Size chart created: ${sizeChart.id} for product ${createSizeChartDto.productId}`, 'SizeChartsService');

    return {
      id: sizeChart.id,
      productId: sizeChart.productId,
      name: sizeChart.name,
      measurements: (sizeChart.measurements as Record<string, any>) || {},
      createdAt: sizeChart.createdAt,
      updatedAt: sizeChart.updatedAt,
    };
  }

  /**
   * Update an existing size chart.
   *
   * @param id - Size chart UUID
   * @param updateSizeChartDto - Size chart update data
   * @returns Updated size chart
   * @throws NotFoundException if size chart not found
   */
  async update(id: string, updateSizeChartDto: UpdateSizeChartDto): Promise<SizeChartResponseDto> {
    const existing = await this.sizeChartsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Size chart with ID ${id} not found`);
    }

    // Validate measurements structure if being updated
    if (updateSizeChartDto.measurements) {
      this.validateMeasurements(updateSizeChartDto.measurements);
    }

    const sizeChart = await this.sizeChartsRepository.update(id, updateSizeChartDto);
    this.logger.log(`Size chart updated: ${id}`, 'SizeChartsService');

    return {
      id: sizeChart.id,
      productId: sizeChart.productId,
      name: sizeChart.name,
      measurements: (sizeChart.measurements as Record<string, any>) || {},
      createdAt: sizeChart.createdAt,
      updatedAt: sizeChart.updatedAt,
    };
  }

  /**
   * Delete a size chart.
   *
   * @param id - Size chart UUID
   * @throws NotFoundException if size chart not found
   */
  async remove(id: string): Promise<void> {
    const existing = await this.sizeChartsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Size chart with ID ${id} not found`);
    }

    await this.sizeChartsRepository.delete(id);
    this.logger.log(`Size chart deleted: ${id}`, 'SizeChartsService');
  }

  /**
   * Validate measurements JSON structure.
   * Expected format: { "S": { "chest": "38", "waist": "32" }, "M": {...} }
   *
   * @param measurements - Measurements object
   * @throws BadRequestException if structure is invalid
   */
  private validateMeasurements(measurements: Record<string, any>): void {
    if (!measurements || typeof measurements !== 'object') {
      throw new BadRequestException('Measurements must be a valid object');
    }

    // Check that it's not an array
    if (Array.isArray(measurements)) {
      throw new BadRequestException('Measurements must be an object, not an array');
    }

    // Validate that each size has measurement data
    for (const [size, data] of Object.entries(measurements)) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new BadRequestException(`Size "${size}" must have an object with measurement data`);
      }
    }
  }
}

