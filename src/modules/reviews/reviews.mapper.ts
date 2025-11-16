/**
 * Reviews Mapper
 *
 * Maps database entities to DTOs.
 */

import { ReviewResponseDto } from './dto/review-response.dto';
import { ReviewsRepository, ReviewWithUser } from './reviews.repository';

export function mapReviewToDto(review: ReviewWithUser): ReviewResponseDto {
  return {
    id: review.id,
    productId: review.productId,
    userId: review.userId,
    rating: review.rating,
    comment: review.comment || undefined,
    moderated: review.moderated,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    user: review.user
      ? {
          id: review.user.id,
          email: review.user.email,
          name: review.user.name || undefined,
        }
      : undefined,
  };
}

