/**
 * Root application service.
 *
 * Provides basic application-level business logic and metadata.
 */

import { Injectable } from '@nestjs/common';

/**
 * AppService provides application-level services
 */
@Injectable()
export class AppService {
  /**
   * Returns health check status
   * Used by load balancers and monitoring systems to verify service availability
   */
  getHealth(): { status: string; message: string; timestamp: string } {
    return {
      status: 'ok',
      message: 'E-commerce Backend API is running',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Returns API information
   * Useful for API discovery and version checking
   */
  getApiInfo(): { name: string; version: string; description: string } {
    return {
      name: 'E-commerce Backend API',
      version: '1.0.0',
      description:
        'Production-minded NestJS e-commerce backend with observability, caching, and modular architecture',
    };
  }
}

