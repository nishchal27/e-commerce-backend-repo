/**
 * Collections Module
 *
 * This module encapsulates all collection-related functionality:
 * - CollectionsController: HTTP endpoints
 * - CollectionsService: Business logic
 * - CollectionsRepository: Data access layer
 */

import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { CollectionsRepository } from './collections.repository';
import { PrismaModule } from '../../lib/prisma/prisma.module';

/**
 * CollectionsModule provides collection-related functionality
 */
@Module({
  imports: [PrismaModule],
  controllers: [CollectionsController],
  providers: [CollectionsService, CollectionsRepository],
  exports: [CollectionsService], // Export service for use in other modules
})
export class CollectionsModule {}

