/**
 * Products Module
 *
 * This module encapsulates all product-related functionality:
 * - ProductsController: HTTP endpoints
 * - ProductsService: Business logic
 * - ProductsRepository: Data access layer
 *
 * The module uses dependency injection to wire everything together.
 */

import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';
import { PrismaModule } from '../../lib/prisma/prisma.module';
import { RedisModule } from '../../lib/redis/redis.module';

/**
 * ProductsModule provides product-related functionality
 */
@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository],
  exports: [ProductsService], // Export service for use in other modules
})
export class ProductsModule {}

