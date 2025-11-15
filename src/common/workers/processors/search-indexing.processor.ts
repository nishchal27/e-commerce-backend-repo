/**
 * Search Indexing Processor
 *
 * This processor handles background jobs for indexing products in the search engine.
 * It processes product create/update events and updates the search index.
 *
 * Responsibilities:
 * - Process product indexing jobs from the queue
 * - Update search index when products are created or updated
 * - Handle bulk reindexing operations
 * - Emit events for search index updates
 *
 * Queue: 'search-indexing'
 * Job Data: { productId: string, action: 'index' | 'delete' | 'reindex' }
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../lib/prisma/prisma.service';
import { OutboxService } from '../../events/outbox.service';
import { PrometheusService } from '../../prometheus/prometheus.service';

interface SearchIndexingJobData {
  productId: string;
  action: 'index' | 'delete' | 'reindex';
}

/**
 * SearchIndexingProcessor processes search indexing jobs
 */
@Processor('search-indexing', {
  concurrency: 5, // Process up to 5 indexing jobs concurrently
  limiter: {
    max: 20, // Maximum 20 jobs per interval
    duration: 1000, // Per second
  },
})
@Injectable()
export class SearchIndexingProcessor extends WorkerHost {
  private readonly logger = new Logger(SearchIndexingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly prometheusService: PrometheusService,
  ) {
    super();
  }

  /**
   * Process a search indexing job.
   *
   * @param job - Search indexing job from queue
   * @returns Promise resolving when indexing is complete
   */
  async process(job: Job<SearchIndexingJobData>): Promise<void> {
    const { productId, action } = job.data;
    const startTime = Date.now();

    this.logger.debug(
      `Processing search indexing job: ${action} for product ${productId}`,
      'SearchIndexingProcessor',
    );

    try {
      switch (action) {
        case 'index':
          await this.indexProduct(productId);
          break;
        case 'delete':
          await this.deleteProduct(productId);
          break;
        case 'reindex':
          await this.reindexProduct(productId);
          break;
        default:
          throw new Error(`Unknown indexing action: ${action}`);
      }

      const latencySeconds = (Date.now() - startTime) / 1000;
      this.prometheusService.recordSearchIndexing(productId, action, latencySeconds);

      this.logger.log(
        `Search indexing completed: ${action} for product ${productId} (${latencySeconds}s)`,
        'SearchIndexingProcessor',
      );
    } catch (error: any) {
      const latencySeconds = (Date.now() - startTime) / 1000;
      this.prometheusService.recordSearchIndexingError(productId, action, latencySeconds);

      this.logger.error(
        `Search indexing failed: ${action} for product ${productId}: ${error.message}`,
        error.stack,
        'SearchIndexingProcessor',
      );
      throw error; // Re-throw to trigger BullMQ retry logic
    }
  }

  /**
   * Index a product in the search engine.
   * For now, this is a placeholder - in production, you would:
   * - Index product in Elasticsearch/Meilisearch
   * - Update search metadata
   * - Cache search results
   *
   * @param productId - Product ID to index
   */
  private async indexProduct(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // In a real implementation, you would:
    // 1. Transform product data for search engine
    // 2. Index in Elasticsearch/Meilisearch
    // 3. Update search metadata cache

    // For now, we'll just emit an event
    await this.outboxService.writeEvent({
      topic: 'search.indexed',
      event: this.outboxService.createEvent(
        'search.indexed.v1',
        {
          product_id: productId,
          action: 'index',
          indexed_at: new Date().toISOString(),
        },
        {},
      ),
    });

    this.logger.debug(`Product ${productId} indexed in search engine`, 'SearchIndexingProcessor');
  }

  /**
   * Delete a product from the search index.
   *
   * @param productId - Product ID to delete
   */
  private async deleteProduct(productId: string): Promise<void> {
    // In a real implementation, you would:
    // 1. Delete from Elasticsearch/Meilisearch
    // 2. Remove from search cache

    await this.outboxService.writeEvent({
      topic: 'search.deleted',
      event: this.outboxService.createEvent(
        'search.deleted.v1',
        {
          product_id: productId,
          action: 'delete',
          deleted_at: new Date().toISOString(),
        },
        {},
      ),
    });

    this.logger.debug(`Product ${productId} deleted from search index`, 'SearchIndexingProcessor');
  }

  /**
   * Reindex a product (delete and re-add).
   *
   * @param productId - Product ID to reindex
   */
  private async reindexProduct(productId: string): Promise<void> {
    await this.deleteProduct(productId);
    await this.indexProduct(productId);
    this.logger.debug(`Product ${productId} reindexed`, 'SearchIndexingProcessor');
  }
}

