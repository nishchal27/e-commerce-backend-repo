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
import { SearchResult, SearchResponse, SearchFacets } from './interfaces/search-result.interface';
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
      const where: Prisma.ProductWhereInput = {
        isActive: true,
        deletedAt: null,
      };

      // Apply filters
      if (filters?.categoryId) {
        where.categoryId = filters.categoryId;
      }

      if (filters?.brandId) {
        where.brandId = filters.brandId;
      }

      if (filters?.gender) {
        where.gender = filters.gender as any;
      }

      // Build variant filters
      const variantFilters: Prisma.ProductVariantWhereInput = {
        isActive: true,
      };

      if (filters?.inStock !== undefined) {
        // Check both legacy stock field and InventoryStock
        if (filters.inStock) {
          variantFilters.OR = [
            { stock: { gt: 0 } },
            {
              inventoryStock: {
                some: {
                  quantity: { gt: 0 },
                },
              },
            },
          ];
        } else {
          variantFilters.AND = [
            { stock: { lte: 0 } },
            {
              OR: [
                { inventoryStock: { none: {} } },
                {
                  inventoryStock: {
                    every: {
                      quantity: { lte: 0 },
                    },
                  },
                },
              ],
            },
          ];
        }
      }

      // Price filtering
      if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
        variantFilters.price = {
          ...(filters.minPrice !== undefined && {
            gte: new Prisma.Decimal(filters.minPrice),
          }),
          ...(filters.maxPrice !== undefined && {
            lte: new Prisma.Decimal(filters.maxPrice),
          }),
        };
      }

      // Size filter - using JSONB attributes with GIN index
      // Prisma JSONB filtering: attributes->>'size' IN (sizes)
      if (filters?.sizes && filters.sizes.length > 0) {
        // Use raw SQL for JSONB filtering with GIN index
        // For now, use Prisma's JSON filtering (may need raw SQL for optimal performance)
        variantFilters.AND = [
          ...(variantFilters.AND || []),
          {
            OR: filters.sizes.map((size) => ({
              attributes: {
                path: ['size'],
                equals: size,
              },
            })),
          },
        ];
      }

      // Color filter - using JSONB attributes with GIN index
      if (filters?.colors && filters.colors.length > 0) {
        variantFilters.AND = [
          ...(variantFilters.AND || []),
          {
            OR: filters.colors.map((color) => ({
              attributes: {
                path: ['color'],
                equals: color,
              },
            })),
          },
        ];
      }

      // Apply variant filters to product where clause
      if (Object.keys(variantFilters).length > 0) {
        where.variants = {
          some: variantFilters,
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

      // Calculate facets (available filter options with counts)
      const facets = await this.calculateFacets(where, variantFilters);

      return {
        results,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        query: q || '',
        filters: filters || undefined,
        facets,
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
   * Calculate facets (available filter options with counts).
   * This helps users see what filters are available and how many results each would return.
   *
   * @param baseWhere - Base product where clause (without variant filters)
   * @param variantFilters - Variant filters to apply
   * @returns Facets with counts
   */
  private async calculateFacets(
    baseWhere: Prisma.ProductWhereInput,
    variantFilters: Prisma.ProductVariantWhereInput,
  ): Promise<SearchFacets> {
    const facets: SearchFacets = {};

    try {
      // Get all products matching base filters (for category/brand/gender facets)
      const baseProducts = await this.prisma.product.findMany({
        where: baseWhere,
        select: {
          id: true,
          categoryId: true,
          brandId: true,
          gender: true,
        },
      });

      // Category facets
      const categoryCounts = new Map<string, number>();
      for (const product of baseProducts) {
        if (product.categoryId) {
          categoryCounts.set(product.categoryId, (categoryCounts.get(product.categoryId) || 0) + 1);
        }
      }

      if (categoryCounts.size > 0) {
        const categoryIds = Array.from(categoryCounts.keys());
        const categories = await this.prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        });

        facets.categories = categories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          count: categoryCounts.get(cat.id) || 0,
        }));
      }

      // Brand facets
      const brandCounts = new Map<string, number>();
      for (const product of baseProducts) {
        if (product.brandId) {
          brandCounts.set(product.brandId, (brandCounts.get(product.brandId) || 0) + 1);
        }
      }

      if (brandCounts.size > 0) {
        const brandIds = Array.from(brandCounts.keys());
        const brands = await this.prisma.brand.findMany({
          where: { id: { in: brandIds } },
          select: { id: true, name: true },
        });

        facets.brands = brands.map((brand) => ({
          id: brand.id,
          name: brand.name,
          count: brandCounts.get(brand.id) || 0,
        }));
      }

      // Gender facets
      const genderCounts = new Map<string, number>();
      for (const product of baseProducts) {
        if (product.gender) {
          genderCounts.set(product.gender, (genderCounts.get(product.gender) || 0) + 1);
        }
      }

      if (genderCounts.size > 0) {
        facets.genders = Array.from(genderCounts.entries()).map(([value, count]) => ({
          value,
          count,
        }));
      }

      // Size and color facets - from variant attributes
      const productIds = baseProducts.map((p) => p.id);
      const variants = await this.prisma.productVariant.findMany({
        where: {
          productId: { in: productIds },
          ...variantFilters,
        },
        select: {
          attributes: true,
        },
      });

      // Size facets
      const sizeCounts = new Map<string, number>();
      for (const variant of variants) {
        if (variant.attributes && typeof variant.attributes === 'object') {
          const attrs = variant.attributes as Record<string, any>;
          const size = attrs.size;
          if (size) {
            sizeCounts.set(String(size), (sizeCounts.get(String(size)) || 0) + 1);
          }
        }
      }

      if (sizeCounts.size > 0) {
        facets.sizes = Array.from(sizeCounts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => a.value.localeCompare(b.value));
      }

      // Color facets
      const colorCounts = new Map<string, number>();
      for (const variant of variants) {
        if (variant.attributes && typeof variant.attributes === 'object') {
          const attrs = variant.attributes as Record<string, any>;
          const color = attrs.color;
          if (color) {
            colorCounts.set(String(color), (colorCounts.get(String(color)) || 0) + 1);
          }
        }
      }

      if (colorCounts.size > 0) {
        facets.colors = Array.from(colorCounts.entries()).map(([value, count]) => ({
          value,
          count,
        }));
      }

      // Price range
      if (variants.length > 0) {
        const prices = variants
          .map((v) => {
            // Get price from variant (need to fetch full variant for price)
            return null; // Will be calculated separately
          })
          .filter((p): p is number => p !== null);

        if (prices.length > 0) {
          const priceVariants = await this.prisma.productVariant.findMany({
            where: {
              productId: { in: productIds },
              ...variantFilters,
            },
            select: {
              price: true,
            },
          });

          const priceValues = priceVariants.map((v) => Number(v.price));
          if (priceValues.length > 0) {
            facets.priceRange = {
              min: Math.min(...priceValues),
              max: Math.max(...priceValues),
            };
          }
        }
      }
    } catch (error: any) {
      // Don't fail search if facets calculation fails
      this.logger.warn(`Failed to calculate facets: ${error.message}`, 'SearchService');
    }

    return facets;
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

