/**
 * Brands Module
 *
 * This module encapsulates all brand-related functionality:
 * - BrandsController: HTTP endpoints
 * - BrandsService: Business logic
 * - BrandsRepository: Data access layer
 */

import { Module } from '@nestjs/common';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { BrandsRepository } from './brands.repository';
import { PrismaModule } from '../../lib/prisma/prisma.module';

/**
 * BrandsModule provides brand-related functionality
 */
@Module({
  imports: [PrismaModule],
  controllers: [BrandsController],
  providers: [BrandsService, BrandsRepository],
  exports: [BrandsService], // Export service for use in other modules
})
export class BrandsModule {}

