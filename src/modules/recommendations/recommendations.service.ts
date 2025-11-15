/**
 * Recommendations Service
 *
 * This service provides product recommendation functionality using multiple strategies.
 *
 * Responsibilities:
 * - Select recommendation strategy based on experiment assignment or default
 * - Aggregate recommendations from multiple strategies
 * - Integrate with Experiments module for A/B testing
 * - Track recommendation impressions and clicks
 * - Emit events for analytics
 *
 * Strategies:
 * - Popularity: Based on sales, ratings, stock
 * - Co-occurrence: Collaborative filtering (users who bought X also bought Y)
 * - Content-based: Similar products by attributes
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { ExperimentsService } from '../experiments/experiments.service';
import { PrometheusService } from '../../common/prometheus/prometheus.service';
import { OutboxService } from '../../common/events/outbox.service';
import { Logger } from '../../lib/logger';
import { GetRecommendationsDto } from './dto/get-recommendations.dto';
import { IRecommendationStrategy, RecommendationOptions } from './interfaces/recommendation-strategy.interface';
import { PopularityStrategy } from './strategies/popularity.strategy';
import { CoOccurrenceStrategy } from './strategies/co-occurrence.strategy';
import { ContentBasedStrategy } from './strategies/content-based.strategy';

@Injectable()
export class RecommendationsService {
  private readonly defaultStrategy: IRecommendationStrategy;

  constructor(
    private readonly prisma: PrismaService,
    private readonly experimentsService: ExperimentsService,
    private readonly prometheusService: PrometheusService,
    private readonly outboxService: OutboxService,
    private readonly popularityStrategy: PopularityStrategy,
    private readonly coOccurrenceStrategy: CoOccurrenceStrategy,
    private readonly contentBasedStrategy: ContentBasedStrategy,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    // Set default strategy from config
    const strategyName = this.configService.get<string>(
      'RECOMMENDATION_STRATEGY',
      'popularity',
    );

    this.defaultStrategy = this.getStrategyByName(strategyName);

    this.logger.log(
      `RecommendationsService initialized with default strategy: ${this.defaultStrategy.name}`,
      'RecommendationsService',
    );
  }

  /**
   * Get product recommendations.
   * Selects strategy based on experiment assignment or default.
   *
   * @param dto - Recommendation request parameters
   * @param userId - Optional user ID for personalization
   * @param requestId - Optional request ID for tracing
   * @param traceId - Optional trace ID for distributed tracing
   * @returns Array of recommended products
   */
  async getRecommendations(
    dto: GetRecommendationsDto,
    userId?: string,
    requestId?: string,
    traceId?: string,
  ) {
    const startTime = Date.now();
    const { productId, limit = 10 } = dto;

    try {
      // Get strategy based on experiment or default
      const { strategy, variant, inExperiment } = this.getStrategy(
        userId || productId || 'anonymous',
        userId ? 'user' : 'session',
      );

      // Note: Impression is automatically tracked by assignVariant in ExperimentsService
      // No need to call recordImpression separately

      // Get recommendations
      const options: RecommendationOptions = {
        productId,
        userId,
        limit,
        excludeProductIds: productId ? [productId] : [],
      };

      const recommendations = await strategy.getRecommendations(options);

      const latencySeconds = (Date.now() - startTime) / 1000;
      this.prometheusService.recordRecommendationQuery(
        strategy.name,
        recommendations.length,
        latencySeconds,
      );

      // Emit recommendation event
      await this.outboxService.writeEvent({
        topic: 'recommendation.generated',
        event: this.outboxService.createEvent(
          'recommendation.generated.v1',
          {
            strategy: variant,
            in_experiment: inExperiment,
            product_id: productId,
            user_id: userId,
            recommendations_count: recommendations.length,
            latency_seconds: latencySeconds,
          },
          {
            request_id: requestId,
            trace_id: traceId,
          },
        ),
      });

      this.logger.log(
        `Recommendations generated: strategy=${variant}, count=${recommendations.length}, latency=${latencySeconds}s`,
        'RecommendationsService',
      );

      return {
        recommendations,
        strategy: variant,
        inExperiment,
        count: recommendations.length,
      };
    } catch (error: any) {
      const latencySeconds = (Date.now() - startTime) / 1000;
      this.prometheusService.recordRecommendationError(latencySeconds);

      this.logger.error(
        `Recommendation generation failed: ${error.message}`,
        error.stack,
        'RecommendationsService',
      );
      throw error;
    }
  }

  /**
   * Record a recommendation click (conversion).
   * Called when a user clicks on a recommended product.
   *
   * @param productId - Recommended product ID that was clicked
   * @param userId - User ID (if authenticated)
   * @param strategy - Strategy that generated the recommendation
   * @param inExperiment - Whether user is in an experiment
   */
  async recordClick(
    productId: string,
    userId?: string,
    strategy?: string,
    inExperiment?: boolean,
  ): Promise<void> {
    try {
      if (inExperiment && strategy) {
        await this.experimentsService.recordConversion(
          'recommendation.strategy',
          userId || productId || 'anonymous',
          strategy,
          'recommendation_click',
          {
            product_id: productId,
          },
        );
      }

      await this.outboxService.writeEvent({
        topic: 'recommendation.clicked',
        event: this.outboxService.createEvent(
          'recommendation.clicked.v1',
          {
            product_id: productId,
            user_id: userId,
            strategy,
            in_experiment: inExperiment,
          },
          {},
        ),
      });

      this.prometheusService.recordRecommendationClick(strategy || 'unknown');
    } catch (error: any) {
      this.logger.warn(
        `Failed to record recommendation click: ${error.message}`,
        'RecommendationsService',
      );
    }
  }

  /**
   * Get recommendation strategy based on experiment assignment or default.
   *
   * @param subjectId - Subject ID (userId, productId, or sessionId)
   * @param subjectType - Subject type ('user', 'session', 'order')
   * @returns Strategy information
   */
  private getStrategy(
    subjectId: string,
    subjectType: 'user' | 'session' | 'order',
  ): {
    strategy: IRecommendationStrategy;
    variant: string;
    inExperiment: boolean;
  } {
    const assignment = this.experimentsService.assignVariant(
      'recommendation.strategy',
      subjectId,
      subjectType,
    );

    if (assignment.inExperiment) {
      const strategy = this.getStrategyByName(assignment.variant);
      return {
        strategy,
        variant: assignment.variant,
        inExperiment: true,
      };
    }

    return {
      strategy: this.defaultStrategy,
      variant: this.defaultStrategy.name,
      inExperiment: false,
    };
  }

  /**
   * Get strategy instance by name.
   *
   * @param name - Strategy name
   * @returns Strategy instance
   */
  private getStrategyByName(name: string): IRecommendationStrategy {
    switch (name) {
      case 'popularity':
        return this.popularityStrategy;
      case 'co_occurrence':
        return this.coOccurrenceStrategy;
      case 'content_based':
        return this.contentBasedStrategy;
      default:
        this.logger.warn(
          `Unknown recommendation strategy: ${name}, falling back to popularity`,
          'RecommendationsService',
        );
        return this.popularityStrategy;
    }
  }
}

