/**
 * Price History Module
 *
 * This module encapsulates all price history-related functionality:
 * - PriceHistoryController: HTTP endpoints
 * - PriceHistoryService: Business logic
 * - PriceHistoryRepository: Data access layer
 */

import { Module } from '@nestjs/common';
import { PriceHistoryController } from './price-history.controller';
import { PriceHistoryService } from './price-history.service';
import { PriceHistoryRepository } from './price-history.repository';
import { PrismaModule } from '../../lib/prisma/prisma.module';

/**
 * PriceHistoryModule provides price history-related functionality
 */
@Module({
  imports: [PrismaModule],
  controllers: [PriceHistoryController],
  providers: [PriceHistoryService, PriceHistoryRepository],
  exports: [PriceHistoryService], // Export service for use in other modules (e.g., Products)
})
export class PriceHistoryModule {}

