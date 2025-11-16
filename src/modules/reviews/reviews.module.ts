/**
 * Reviews Module
 *
 * Provides product reviews and ratings functionality.
 */

import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsRepository } from './reviews.repository';
import { PrismaModule } from '../../lib/prisma/prisma.module';
import { EventsModule } from '../../common/events/events.module';
import { PrometheusModule } from '../../common/prometheus/prometheus.module';
import { LoggerModule } from '../../lib/logger/logger.module';

@Module({
  imports: [PrismaModule, EventsModule, PrometheusModule, LoggerModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsRepository],
  exports: [ReviewsService],
})
export class ReviewsModule {}

