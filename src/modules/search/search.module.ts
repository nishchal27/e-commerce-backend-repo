/**
 * Search Module
 *
 * This module provides product search functionality.
 *
 * Responsibilities:
 * - Full-text product search using PostgreSQL
 * - Search result ranking and relevance
 * - Search analytics and metrics
 *
 * Dependencies:
 * - PrismaModule: Database access
 * - PrometheusModule: Metrics collection
 * - EventsModule: Event publishing for analytics
 * - LoggerModule: Structured logging
 */

import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { PrismaModule } from '../../lib/prisma/prisma.module';
import { PrometheusModule } from '../../common/prometheus/prometheus.module';
import { EventsModule } from '../../common/events/events.module';
import { LoggerModule } from '../../lib/logger/logger.module';

@Module({
  imports: [PrismaModule, PrometheusModule, EventsModule, LoggerModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}

