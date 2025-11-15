/**
 * Recommendations Module
 *
 * This module provides product recommendation functionality.
 *
 * Responsibilities:
 * - Multiple recommendation strategies (popularity, co-occurrence, content-based)
 * - A/B testing integration via Experiments module
 * - Recommendation analytics and metrics
 *
 * Dependencies:
 * - PrismaModule: Database access
 * - ExperimentsModule: A/B testing
 * - PrometheusModule: Metrics collection
 * - EventsModule: Event publishing for analytics
 * - LoggerModule: Structured logging
 */

import { Module } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { PopularityStrategy } from './strategies/popularity.strategy';
import { CoOccurrenceStrategy } from './strategies/co-occurrence.strategy';
import { ContentBasedStrategy } from './strategies/content-based.strategy';
import { PrismaModule } from '../../lib/prisma/prisma.module';
import { ExperimentsModule } from '../experiments/experiments.module';
import { PrometheusModule } from '../../common/prometheus/prometheus.module';
import { EventsModule } from '../../common/events/events.module';
import { LoggerModule } from '../../lib/logger/logger.module';

@Module({
  imports: [
    PrismaModule,
    ExperimentsModule,
    PrometheusModule,
    EventsModule,
    LoggerModule,
  ],
  controllers: [RecommendationsController],
  providers: [
    RecommendationsService,
    PopularityStrategy,
    CoOccurrenceStrategy,
    ContentBasedStrategy,
  ],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}

