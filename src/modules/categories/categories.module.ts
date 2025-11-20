/**
 * Categories Module
 *
 * This module encapsulates all category-related functionality:
 * - CategoriesController: HTTP endpoints
 * - CategoriesService: Business logic
 * - CategoriesRepository: Data access layer
 */

import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './categories.repository';
import { PrismaModule } from '../../lib/prisma/prisma.module';

/**
 * CategoriesModule provides category-related functionality
 */
@Module({
  imports: [PrismaModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository],
  exports: [CategoriesService], // Export service for use in other modules
})
export class CategoriesModule {}

