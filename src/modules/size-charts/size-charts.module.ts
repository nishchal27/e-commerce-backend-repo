/**
 * Size Charts Module
 *
 * This module encapsulates all size chart-related functionality:
 * - SizeChartsController: HTTP endpoints
 * - SizeChartsService: Business logic
 * - SizeChartsRepository: Data access layer
 */

import { Module } from '@nestjs/common';
import { SizeChartsController } from './size-charts.controller';
import { SizeChartsService } from './size-charts.service';
import { SizeChartsRepository } from './size-charts.repository';
import { PrismaModule } from '../../lib/prisma/prisma.module';

/**
 * SizeChartsModule provides size chart-related functionality
 */
@Module({
  imports: [PrismaModule],
  controllers: [SizeChartsController],
  providers: [SizeChartsService, SizeChartsRepository],
  exports: [SizeChartsService], // Export service for use in other modules
})
export class SizeChartsModule {}

