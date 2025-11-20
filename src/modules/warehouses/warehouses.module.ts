/**
 * Warehouses Module
 *
 * This module encapsulates all warehouse-related functionality:
 * - WarehousesController: HTTP endpoints
 * - WarehousesService: Business logic
 * - WarehousesRepository: Data access layer
 */

import { Module } from '@nestjs/common';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';
import { WarehousesRepository } from './warehouses.repository';
import { PrismaModule } from '../../lib/prisma/prisma.module';

/**
 * WarehousesModule provides warehouse-related functionality
 */
@Module({
  imports: [PrismaModule],
  controllers: [WarehousesController],
  providers: [WarehousesService, WarehousesRepository],
  exports: [WarehousesService], // Export service for use in other modules (e.g., Inventory)
})
export class WarehousesModule {}

