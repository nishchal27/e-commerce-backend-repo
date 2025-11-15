/**
 * Search Controller
 *
 * This controller handles HTTP requests for product search.
 *
 * Endpoints:
 * - GET /search - Search products with query, filters, and pagination
 *
 * Features:
 * - Full-text search using PostgreSQL
 * - Filtering by category, price, stock
 * - Pagination support
 * - Public access (no authentication required)
 */

import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  Optional,
} from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RequestWithId } from '../../common/middleware/request-id.middleware';

@Public() // Search is public - no authentication required
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Search products.
   *
   * GET /search?q=query&page=1&limit=20&filters[categoryId]=xxx&filters[minPrice]=10
   *
   * @param queryDto - Search query parameters
   * @param user - Optional authenticated user (for personalization)
   * @param req - Request object with request ID
   * @returns Search results with pagination
   */
  @Get()
  async search(
    @Query() queryDto: SearchQueryDto,
    @CurrentUser() @Optional() user: JwtPayload | undefined,
    @Req() req: RequestWithId,
  ) {
    return this.searchService.search(
      queryDto,
      user?.sub,
      req.requestId,
      req.traceId,
    );
  }
}

