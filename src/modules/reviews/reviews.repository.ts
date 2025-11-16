/**
 * Reviews Repository
 *
 * Abstracts database operations for reviews.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { Prisma } from '@prisma/client';

export type ReviewWithUser = Prisma.ReviewGetPayload<{
  include: { user: true };
}>;

@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    data: CreateReviewDto,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewWithUser> {
    const client = tx || this.prisma;
    return (client as any).review.create({
      data: {
        productId: data.productId,
        userId,
        rating: data.rating,
        comment: data.comment,
        moderated: false,
      },
      include: { user: true },
    });
  }

  async findByProduct(
    productId: string,
    skip: number = 0,
    take: number = 20,
    moderatedOnly: boolean = true,
  ): Promise<ReviewWithUser[]> {
    return (this.prisma as any).review.findMany({
      where: {
        productId,
        moderated: moderatedOnly ? true : undefined,
      },
      skip,
      take,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<ReviewWithUser | null> {
    return (this.prisma as any).review.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  async findByUserAndProduct(
    userId: string,
    productId: string,
  ): Promise<ReviewWithUser | null> {
    return (this.prisma as any).review.findFirst({
      where: {
        userId,
        productId,
      },
      include: { user: true },
    });
  }

  async updateModerationStatus(
    id: string,
    moderated: boolean,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewWithUser> {
    const client = tx || this.prisma;
    return (client as any).review.update({
      where: { id },
      data: { moderated },
      include: { user: true },
    });
  }

  async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || this.prisma;
    await (client as any).review.delete({
      where: { id },
    });
  }

  async getAverageRating(productId: string): Promise<number> {
    const result = await (this.prisma as any).review.aggregate({
      where: {
        productId,
        moderated: true,
      },
      _avg: {
        rating: true,
      },
    });

    return result._avg.rating || 0;
  }

  async getRatingDistribution(productId: string): Promise<Record<number, number>> {
    const reviews = await (this.prisma as any).review.findMany({
      where: {
        productId,
        moderated: true,
      },
      select: {
        rating: true,
      },
    });

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((review: any) => {
      distribution[review.rating] = (distribution[review.rating] || 0) + 1;
    });

    return distribution;
  }

  async count(productId?: string): Promise<number> {
    return (this.prisma as any).review.count({
      where: {
        productId,
        moderated: true,
      },
    });
  }
}

