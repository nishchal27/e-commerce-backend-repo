/**
 * Reviews Service
 *
 * Business logic for product reviews and ratings.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ReviewsRepository } from './reviews.repository';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { OutboxService } from '../../common/events/outbox.service';
import { PrometheusService } from '../../common/prometheus/prometheus.service';
import { Logger } from '../../lib/logger';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { mapReviewToDto } from './reviews.mapper';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviewsRepository: ReviewsRepository,
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly prometheusService: PrometheusService,
    private readonly logger: Logger,
  ) {}

  /**
   * Create a new review
   */
  async create(
    userId: string,
    createReviewDto: CreateReviewDto,
    requestId?: string,
    traceId?: string,
  ): Promise<ReviewResponseDto> {
    // Check if user already reviewed this product
    const existingReview = await this.reviewsRepository.findByUserAndProduct(
      userId,
      createReviewDto.productId,
    );

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this product');
    }

    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: createReviewDto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${createReviewDto.productId} not found`);
    }

    // Create review in transaction
    const review = await this.prisma.$transaction(async (tx) => {
      const newReview = await this.reviewsRepository.create(userId, createReviewDto, tx);

      // Emit review.created event
      await this.outboxService.writeEvent({
        topic: 'review.created',
        event: this.outboxService.createEvent(
          'review.created.v1',
          {
            review_id: newReview.id,
            product_id: newReview.productId,
            user_id: newReview.userId,
            rating: newReview.rating,
            has_comment: !!newReview.comment,
          },
          {
            request_id: requestId,
            trace_id: traceId,
          },
        ),
        tx,
      });

      return newReview;
    });

    this.logger.log(`Review created: ${review.id} for product ${createReviewDto.productId}`, 'ReviewsService');
    return mapReviewToDto(review);
  }

  /**
   * Get reviews for a product
   */
  async findByProduct(
    productId: string,
    page: number = 1,
    limit: number = 20,
    moderatedOnly: boolean = true,
  ): Promise<{ data: ReviewResponseDto[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const reviews = await this.reviewsRepository.findByProduct(
      productId,
      skip,
      limit,
      moderatedOnly,
    );
    const total = await this.reviewsRepository.count(productId);

    return {
      data: reviews.map(mapReviewToDto),
      total,
      page,
      limit,
    };
  }

  /**
   * Get review by ID
   */
  async findOne(id: string): Promise<ReviewResponseDto> {
    const review = await this.reviewsRepository.findById(id);
    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }
    return mapReviewToDto(review);
  }

  /**
   * Moderate a review (admin only)
   */
  async moderate(
    id: string,
    moderated: boolean,
    requestId?: string,
    traceId?: string,
  ): Promise<ReviewResponseDto> {
    const review = await this.reviewsRepository.findById(id);
    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    const updatedReview = await this.reviewsRepository.updateModerationStatus(id, moderated);

    await this.outboxService.writeEvent({
      topic: 'review.moderated',
      event: this.outboxService.createEvent(
        'review.moderated.v1',
        {
          review_id: id,
          product_id: review.productId,
          moderated,
        },
        {
          request_id: requestId,
          trace_id: traceId,
        },
      ),
    });

    this.logger.log(`Review ${id} moderation status updated: ${moderated}`, 'ReviewsService');
    return mapReviewToDto(updatedReview);
  }

  /**
   * Delete a review
   */
  async delete(id: string, userId: string, requestId?: string, traceId?: string): Promise<void> {
    const review = await this.reviewsRepository.findById(id);
    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    // Only allow user to delete their own review (or admin via separate endpoint)
    if (review.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    await this.reviewsRepository.delete(id);

    await this.outboxService.writeEvent({
      topic: 'review.deleted',
      event: this.outboxService.createEvent(
        'review.deleted.v1',
        {
          review_id: id,
          product_id: review.productId,
          user_id: userId,
        },
        {
          request_id: requestId,
          trace_id: traceId,
        },
      ),
    });

    this.logger.log(`Review deleted: ${id}`, 'ReviewsService');
  }

  /**
   * Get product rating statistics
   */
  async getProductRatingStats(productId: string): Promise<{
    averageRating: number;
    totalReviews: number;
    distribution: Record<number, number>;
  }> {
    const [averageRating, totalReviews, distribution] = await Promise.all([
      this.reviewsRepository.getAverageRating(productId),
      this.reviewsRepository.count(productId),
      this.reviewsRepository.getRatingDistribution(productId),
    ]);

    return {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      totalReviews,
      distribution,
    };
  }
}

