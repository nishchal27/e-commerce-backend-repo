/**
 * Suppliers Module
 *
 * This module encapsulates all supplier-related functionality:
 * - SuppliersController: HTTP endpoints
 * - SuppliersService: Business logic
 * - SuppliersRepository: Data access layer
 */

import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { SuppliersRepository } from './suppliers.repository';
import { PrismaModule } from '../../lib/prisma/prisma.module';

/**
 * SuppliersModule provides supplier-related functionality
 */
@Module({
  imports: [PrismaModule],
  controllers: [SuppliersController],
  providers: [SuppliersService, SuppliersRepository],
  exports: [SuppliersService], // Export service for use in other modules
})
export class SuppliersModule {}

