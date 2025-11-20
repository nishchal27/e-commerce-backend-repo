/**
 * Promotions Module
 *
 * This module encapsulates all promotion-related functionality:
 * - PromotionsController: HTTP endpoints
 * - PromotionsService: Business logic
 * - PromotionsRepository: Data access layer
 */

import { Module } from '@nestjs/common';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { PromotionsRepository } from './promotions.repository';
import { PrismaModule } from '../../lib/prisma/prisma.module';

/**
 * PromotionsModule provides promotion-related functionality
 */
@Module({
  imports: [PrismaModule],
  controllers: [PromotionsController],
  providers: [PromotionsService, PromotionsRepository],
  exports: [PromotionsService], // Export service for use in other modules (e.g., Orders)
})
export class PromotionsModule {}

