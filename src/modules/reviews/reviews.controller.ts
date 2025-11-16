/**
 * Reviews Controller
 *
 * HTTP endpoints for product reviews.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RequestWithId } from '../../common/middleware/request-id.middleware';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createReviewDto: CreateReviewDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: RequestWithId,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.create(
      user.sub,
      createReviewDto,
      req.requestId,
      req.traceId,
    );
  }

  @Get('product/:productId')
  async findByProduct(
    @Param('productId') productId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('moderatedOnly', new DefaultValuePipe('true')) moderatedOnly: string,
  ) {
    const maxLimit = 100;
    const actualLimit = Math.min(limit, maxLimit);
    return this.reviewsService.findByProduct(
      productId,
      page,
      actualLimit,
      moderatedOnly === 'true',
    );
  }

  @Get('product/:productId/stats')
  async getProductRatingStats(@Param('productId') productId: string) {
    return this.reviewsService.getProductRatingStats(productId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ReviewResponseDto> {
    return this.reviewsService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: RequestWithId,
  ): Promise<void> {
    await this.reviewsService.delete(id, user.sub, req.requestId, req.traceId);
  }

  @Post(':id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async moderate(
    @Param('id') id: string,
    @Body('moderated') moderated: boolean,
    @Req() req: RequestWithId,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.moderate(id, moderated, req.requestId, req.traceId);
  }
}

