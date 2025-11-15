/**
 * Experiments Module
 *
 * This module provides A/B testing and experiment management functionality.
 * It handles variant assignment, experiment tracking, and conversion recording.
 *
 * Responsibilities:
 * - Experiment configuration management
 * - Deterministic variant assignment
 * - Experiment event emission
 * - Integration with Outbox for reliable event publishing
 */

import { Module } from '@nestjs/common';
import { ExperimentsService } from './experiments.service';
import { ExperimentsController } from './experiments.controller';
import { PrismaModule } from '../../lib/prisma/prisma.module';
import { EventsModule } from '../../common/events/events.module';
import { LoggerModule } from '../../lib/logger/logger.module';

/**
 * ExperimentsModule provides A/B testing functionality
 */
@Module({
  imports: [
    // Prisma for database access
    PrismaModule,
    // Events module for OutboxService (event publishing)
    EventsModule,
    // Logger for structured logging
    LoggerModule,
  ],
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
  exports: [ExperimentsService], // Export service for use in other modules (e.g., Inventory)
})
export class ExperimentsModule {}
