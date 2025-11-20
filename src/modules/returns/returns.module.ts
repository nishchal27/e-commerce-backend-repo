/**
 * Returns Module
 *
 * This module encapsulates all return/RMA-related functionality:
 * - ReturnsController: HTTP endpoints
 * - ReturnsService: Business logic
 * - ReturnsRepository: Data access layer
 */

import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { ReturnsRepository } from './returns.repository';
import { PrismaModule } from '../../lib/prisma/prisma.module';

/**
 * ReturnsModule provides return/RMA-related functionality
 */
@Module({
  imports: [PrismaModule],
  controllers: [ReturnsController],
  providers: [ReturnsService, ReturnsRepository],
  exports: [ReturnsService], // Export service for use in other modules
})
export class ReturnsModule {}

