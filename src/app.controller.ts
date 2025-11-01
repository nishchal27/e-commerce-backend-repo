/**
 * Root application controller.
 *
 * Provides basic health check and API information endpoints.
 * Useful for monitoring, load balancer health checks, and API discovery.
 */

import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * AppController handles root-level API endpoints
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check endpoint
   * GET /
   * Returns a simple health status for monitoring and load balancers
   */
  @Get()
  getHealth(): { status: string; message: string; timestamp: string } {
    return this.appService.getHealth();
  }

  /**
   * API information endpoint
   * GET /api/info
   * Returns basic API metadata (version, name, etc.)
   */
  @Get('api/info')
  getApiInfo(): { name: string; version: string; description: string } {
    return this.appService.getApiInfo();
  }
}

