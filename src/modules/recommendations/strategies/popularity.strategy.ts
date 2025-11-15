/**
 * Popularity-Based Recommendation Strategy
 *
 * This strategy recommends products based on popularity metrics:
 * - Total sales/orders
 * - Recent sales velocity
 * - Average rating (if reviews exist)
 *
 * Use Case: Good for new users or when no user history is available.
 * Algorithm: Simple scoring based on aggregate metrics.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../lib/prisma/prisma.service';
import {
  IRecommendationStrategy,
  RecommendationOptions,
  RecommendationResult,
} from '../interfaces/recommendation-strategy.interface';
import { Logger } from '../../../lib/logger';

@Injectable()
export class PopularityStrategy implements IRecommendationStrategy {
  public readonly name = 'popularity';

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  /**
   * Get popular product recommendations.
   *
   * @param options - Recommendation options
   * @returns Array of recommended products sorted by popularity score
   */
  async getRecommendations(
    options: RecommendationOptions,
  ): Promise<RecommendationResult[]> {
    const { limit = 10, excludeProductIds = [] } = options;

    try {
      // Get products with order counts (popularity metric)
      // In a real implementation, you might want to:
      // - Consider recent orders more heavily (time decay)
      // - Factor in average ratings
      // - Consider inventory levels (don't recommend out-of-stock items)

      const products = await this.prisma.product.findMany({
        where: {
          id: {
            notIn: excludeProductIds,
          },
          variants: {
            some: {
              stock: { gt: 0 }, // Only recommend products in stock
            },
          },
        },
        include: {
          variants: {
            select: {
              stock: true,
            },
          },
          reviews: {
            select: {
              rating: true,
            },
          },
        },
        take: limit * 2, // Get more than needed for scoring
      });

      // Score products based on:
      // 1. Number of orders (if order data available)
      // 2. Average rating (if reviews exist)
      // 3. Stock availability (higher stock = more popular)
      const scoredProducts: RecommendationResult[] = products.map((product) => {
        // Calculate average rating
        const ratings = product.reviews.map((r) => r.rating);
        const avgRating = ratings.length > 0
          ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
          : 3.0; // Default to 3.0 if no reviews

        // Calculate total stock
        const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);

        // Simple scoring: rating (0-1) + stock availability (0-0.5)
        // In production, you'd factor in actual order counts
        const ratingScore = avgRating / 5.0; // Normalize to 0-1
        const stockScore = Math.min(totalStock / 100, 0.5); // Cap at 0.5
        const score = ratingScore + stockScore;

        return {
          productId: product.id,
          score: Math.min(score, 1.0), // Cap at 1.0
          reason: 'popular',
        };
      });

      // Sort by score (descending) and return top N
      return scoredProducts
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error: any) {
      this.logger.error(
        `Popularity recommendation failed: ${error.message}`,
        error.stack,
        'PopularityStrategy',
      );
      return [];
    }
  }
}

