/**
 * Content-Based Recommendation Strategy
 *
 * This strategy recommends products based on content similarity:
 * - Similar product attributes (category, tags, description)
 * - Similar variant attributes (size, color, etc.)
 * - Text similarity (title, description)
 *
 * Algorithm: Cosine similarity or attribute matching
 * Use Case: "Products similar to X"
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
export class ContentBasedStrategy implements IRecommendationStrategy {
  public readonly name = 'content_based';

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  /**
   * Get content-based recommendations.
   *
   * @param options - Recommendation options
   * @returns Array of recommended products based on content similarity
   */
  async getRecommendations(
    options: RecommendationOptions,
  ): Promise<RecommendationResult[]> {
    const { productId, limit = 10, excludeProductIds = [] } = options;

    if (!productId) {
      // Content-based requires a reference product
      return [];
    }

    try {
      // Get the reference product
      const referenceProduct = await this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          variants: {
            select: {
              attributes: true,
            },
          },
        },
      });

      if (!referenceProduct) {
        return [];
      }

      // Find similar products based on:
      // 1. Same category
      // 2. Similar title/description (text similarity)
      // 3. Similar variant attributes

      const similarProducts = await this.prisma.product.findMany({
        where: {
          id: {
            notIn: [productId, ...excludeProductIds],
          },
          ...(referenceProduct.categoryId && {
            categoryId: referenceProduct.categoryId,
          }),
          variants: {
            some: {
              stock: { gt: 0 }, // Only recommend in-stock items
            },
          },
        },
        include: {
          variants: {
            select: {
              attributes: true,
            },
          },
        },
        take: limit * 2, // Get more for scoring
      });

      // Score products based on similarity
      const results: RecommendationResult[] = similarProducts.map((product) => {
        let score = 0.0;

        // Category match: +0.5
        if (product.categoryId === referenceProduct.categoryId) {
          score += 0.5;
        }

        // Title similarity: +0.3 (simple word overlap)
        const titleWords = new Set(
          product.title.toLowerCase().split(/\s+/),
        );
        const refTitleWords = new Set(
          referenceProduct.title.toLowerCase().split(/\s+/),
        );
        const commonWords = [...titleWords].filter((w) => refTitleWords.has(w));
        score += (commonWords.length / Math.max(titleWords.size, refTitleWords.size)) * 0.3;

        // Variant attribute similarity: +0.2
        // In production, you'd do more sophisticated matching
        score += 0.2; // Placeholder

        return {
          productId: product.id,
          score: Math.min(score, 1.0),
          reason: 'content_similar',
        };
      });

      // Sort by score and return top N
      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error: any) {
      this.logger.error(
        `Content-based recommendation failed: ${error.message}`,
        error.stack,
        'ContentBasedStrategy',
      );
      return [];
    }
  }
}

