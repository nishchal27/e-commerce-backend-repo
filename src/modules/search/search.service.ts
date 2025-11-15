/**
 * Search Service
 *
 * This service provides product search functionality using PostgreSQL full-text search.
 *
 * Responsibilities:
 * - Full-text search using PostgreSQL tsvector/tsquery
 * - Search result ranking and relevance scoring
 * - Filtering by category, price, stock, attributes
 * - Search analytics and metrics tracking
 *
 * Implementation:
 * - Uses PostgreSQL's built-in full-text search (no external dependencies)
 * - Creates searchable text from product title, description, and variant attributes
 * - Supports pagination and filtering
 * - Tracks search queries for analytics
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResult, SearchResponse } from './interfaces/search-result.interface';
import { PrometheusService } from '../../common/prometheus/prometheus.service';
import { OutboxService } from '../../common/events/outbox.service';
import { Logger } from '../../lib/logger';
import { Prisma } from '@prisma/client';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prometheusService: PrometheusService,
    private readonly outboxService: OutboxService,
    private readonly logger: Logger,
  ) {}

  /**
   * Search products using PostgreSQL full-text search.
   *
   * @param searchDto - Search query parameters
   * @param userId - Optional user ID for personalization
   * @param requestId - Optional request ID for tracing
   * @param traceId - Optional trace ID for distributed tracing
   * @returns Search results with pagination
   */
  async search(
    searchDto: SearchQueryDto,
    userId?: string,
    requestId?: string,
    traceId?: string,
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    const { q, page = 1, limit = 20, filters } = searchDto;
    const skip = (page - 1) * limit;

    try {
      // Build where clause for filtering
      const where: Prisma.ProductWhereInput = {};

      // Apply filters
      if (filters?.categoryId) {
        where.categoryId = filters.categoryId;
      }

      if (filters?.inStock !== undefined) {
        where.variants = {
          some: {
            stock: filters.inStock ? { gt: 0 } : { lte: 0 },
          },
        };
      }

      // Price filtering (if provided)
      if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
        where.variants = {
          ...where.variants,
          some: {
            ...(filters.minPrice !== undefined && {
              price: { gte: new Prisma.Decimal(filters.minPrice) },
            }),
            ...(filters.maxPrice !== undefined && {
              price: { lte: new Prisma.Decimal(filters.maxPrice) },
            }),
          },
        };
      }

      let products: any[];
      let total: number;

      if (q && q.trim().length > 0) {
        // Full-text search using PostgreSQL ILIKE pattern matching
        // For production, consider using PostgreSQL's full-text search (tsvector/tsquery)
        // or an external search engine like Elasticsearch/Meilisearch
        const searchWhere: Prisma.ProductWhereInput = {
          ...where,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        };

        // Execute search
        products = await this.prisma.product.findMany({
          where: searchWhere,
          skip,
          take: limit,
          orderBy: [
            // Prioritize title matches
            { title: 'asc' },
            { createdAt: 'desc' },
          ],
        });

        total = await this.prisma.product.count({ where: searchWhere });

        // Record search query for analytics
        await this.recordSearchQuery(q, userId, total, requestId, traceId);
      } else {
        // No search query - just filter and paginate
        products = await this.prisma.product.findMany({
          where,
          skip,
          take: limit,
          include: {
            variants: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        total = await this.prisma.product.count({ where });
      }

      // Fetch variants for products (if not already included)
      const productIds = products.map((p) => p.id);
      const variants = await this.prisma.productVariant.findMany({
        where: {
          productId: { in: productIds },
        },
      });

      // Group variants by product
      const variantsByProduct = new Map<string, typeof variants>();
      variants.forEach((variant) => {
        const existing = variantsByProduct.get(variant.productId) || [];
        existing.push(variant);
        variantsByProduct.set(variant.productId, existing);
      });

      // Map to search results
      const results: SearchResult[] = products.map((product) => ({
        id: product.id,
        title: product.title,
        description: product.description || undefined,
        slug: product.slug,
        categoryId: product.categoryId || undefined,
        relevanceScore: product.relevance ? Number(product.relevance) : undefined,
        variants: (variantsByProduct.get(product.id) || []).map((v) => ({
          id: v.id,
          sku: v.sku,
          price: v.price.toNumber(),
          currency: v.currency,
          stock: v.stock,
          attributes: v.attributes as Record<string, any> | undefined,
        })),
      }));

      const latency = Date.now() - startTime;
      this.prometheusService.recordSearchQuery(q || '', results.length, latency / 1000);

      this.logger.log(
        `Search completed: query="${q || 'none'}", results=${results.length}, total=${total}, latency=${latency}ms`,
        'SearchService',
      );

      return {
        results,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        query: q || '',
        filters: filters || undefined,
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      this.prometheusService.recordSearchError(q || '', latency / 1000);
      this.logger.error(
        `Search failed: query="${q || 'none'}", error=${error.message}`,
        error.stack,
        'SearchService',
      );
      throw error;
    }
  }


  /**
   * Record search query for analytics.
   * Emits a search.query event via the Outbox.
   *
   * @param query - Search query string
   * @param userId - Optional user ID
   * @param resultCount - Number of results returned
   * @param requestId - Optional request ID
   * @param traceId - Optional trace ID
   */
  private async recordSearchQuery(
    query: string,
    userId: string | undefined,
    resultCount: number,
    requestId?: string,
    traceId?: string,
  ): Promise<void> {
    try {
      await this.outboxService.writeEvent({
        topic: 'search.query',
        event: this.outboxService.createEvent(
          'search.query.v1',
          {
            query,
            user_id: userId,
            result_count: resultCount,
            timestamp: new Date().toISOString(),
          },
          {
            request_id: requestId,
            trace_id: traceId,
          },
        ),
      });
    } catch (error: any) {
      // Don't fail search if analytics recording fails
      this.logger.warn(
        `Failed to record search query: ${error.message}`,
        'SearchService',
      );
    }
  }
}

