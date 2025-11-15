/**
 * Health Controller
 *
 * This controller provides health check endpoints for monitoring and load balancers.
 *
 * Endpoints:
 * - GET /health - Simple health check (for load balancers)
 * - GET /health/detailed - Detailed health status with all components
 */

import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../../../modules/auth/decorators/public.decorator';

@Public() // Health checks should be public
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Simple health check endpoint
   * GET /health
   *
   * Returns simple status for load balancers and monitoring systems.
   * Returns 200 OK if healthy, 503 Service Unavailable if unhealthy.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getHealth() {
    const health = await this.healthService.getSimpleHealth();
    
    // Return 503 if unhealthy (for load balancers)
    if (health.status !== 'ok') {
      return { status: 'unhealthy', timestamp: health.timestamp };
    }
    
    return health;
  }

  /**
   * Detailed health check endpoint
   * GET /health/detailed
   *
   * Returns comprehensive health status with all component checks.
   */
  @Get('detailed')
  @HttpCode(HttpStatus.OK)
  async getDetailedHealth() {
    return this.healthService.getHealthStatus();
  }
}

