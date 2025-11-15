/**
 * Recommendations Controller
 *
 * This controller handles HTTP requests for product recommendations.
 *
 * Endpoints:
 * - GET /recommendations - Get product recommendations
 * - POST /recommendations/click - Record a recommendation click
 *
 * Features:
 * - Multiple recommendation strategies (popularity, co-occurrence, content-based)
 * - A/B testing integration
 * - Public access (no authentication required, but user context helps)
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  Optional,
} from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { GetRecommendationsDto } from './dto/get-recommendations.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RequestWithId } from '../../common/middleware/request-id.middleware';

@Public() // Recommendations are public
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  /**
   * Get product recommendations.
   *
   * GET /recommendations?productId=xxx&userId=yyy&limit=10
   *
   * @param queryDto - Recommendation query parameters
   * @param user - Optional authenticated user (for personalization)
   * @param req - Request object with request ID
   * @returns Recommendations with strategy information
   */
  @Get()
  async getRecommendations(
    @Query() queryDto: GetRecommendationsDto,
    @CurrentUser() @Optional() user: JwtPayload | undefined,
    @Req() req: RequestWithId,
  ) {
    return this.recommendationsService.getRecommendations(
      queryDto,
      user?.sub || queryDto.userId,
      req.requestId,
      req.traceId,
    );
  }

  /**
   * Record a recommendation click.
   *
   * POST /recommendations/click
   * Body: { productId: string, strategy?: string, inExperiment?: boolean }
   *
   * @param body - Click data
   * @param user - Optional authenticated user
   * @returns Success response
   */
  @Post('click')
  async recordClick(
    @Body() body: { productId: string; strategy?: string; inExperiment?: boolean },
    @CurrentUser() @Optional() user: JwtPayload | undefined,
  ) {
    await this.recommendationsService.recordClick(
      body.productId,
      user?.sub,
      body.strategy,
      body.inExperiment,
    );
    return { success: true };
  }
}

