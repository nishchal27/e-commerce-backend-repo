/**
 * Size Charts Repository
 *
 * This repository abstracts database operations for size charts.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { CreateSizeChartDto } from './dto/create-size-chart.dto';
import { UpdateSizeChartDto } from './dto/update-size-chart.dto';
import { Prisma } from '@prisma/client';

/**
 * SizeChartsRepository handles all database operations for size charts
 */
@Injectable()
export class SizeChartsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find size chart by product ID.
   *
   * @param productId - Product UUID
   * @returns Size chart or null if not found
   */
  async findByProductId(productId: string): Promise<Prisma.SizeChartGetPayload<{}> | null> {
    return this.prisma.sizeChart.findUnique({
      where: { productId },
    });
  }

  /**
   * Find size chart by ID.
   *
   * @param id - Size chart UUID
   * @returns Size chart or null if not found
   */
  async findById(id: string): Promise<Prisma.SizeChartGetPayload<{}> | null> {
    return this.prisma.sizeChart.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });
  }

  /**
   * Create a new size chart.
   *
   * @param data - Size chart creation data
   * @returns Created size chart
   */
  async create(data: CreateSizeChartDto): Promise<Prisma.SizeChartGetPayload<{}>> {
    return this.prisma.sizeChart.create({
      data: {
        productId: data.productId,
        name: data.name,
        measurements: data.measurements,
      },
      include: {
        product: true,
      },
    });
  }

  /**
   * Update an existing size chart.
   *
   * @param id - Size chart UUID
   * @param data - Size chart update data
   * @returns Updated size chart
   */
  async update(id: string, data: UpdateSizeChartDto): Promise<Prisma.SizeChartGetPayload<{}>> {
    return this.prisma.sizeChart.update({
      where: { id },
      data,
      include: {
        product: true,
      },
    });
  }

  /**
   * Delete a size chart.
   *
   * @param id - Size chart UUID
   * @returns Deleted size chart
   */
  async delete(id: string): Promise<Prisma.SizeChartGetPayload<{}>> {
    return this.prisma.sizeChart.delete({
      where: { id },
    });
  }
}

