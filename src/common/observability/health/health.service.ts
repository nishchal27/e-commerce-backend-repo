/**
 * Health Service
 *
 * This service provides comprehensive health check functionality.
 * It checks the health of all system components (database, Redis, queues, etc.)
 *
 * Responsibilities:
 * - Check database connectivity
 * - Check Redis connectivity
 * - Check queue health
 * - Check external service dependencies
 * - Provide detailed health status
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../lib/prisma/prisma.service';
import { RedisService } from '../../../lib/redis/redis.service';
import { WorkerMonitoringService } from '../../workers/services/worker-monitoring.service';
import { Logger } from '../../../lib/logger';

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  latency?: number; // Response time in milliseconds
  details?: Record<string, any>;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  components: ComponentHealth[];
}

/**
 * HealthService provides comprehensive health checks
 */
@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly workerMonitoring: WorkerMonitoringService,
    private readonly logger: Logger,
  ) {}

  /**
   * Get comprehensive health status
   *
   * @returns Health status with all component checks
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const components: ComponentHealth[] = [];

    // Check database
    const dbHealth = await this.checkDatabase();
    components.push(dbHealth);

    // Check Redis
    const redisHealth = await this.checkRedis();
    components.push(redisHealth);

    // Check queues
    const queueHealth = await this.checkQueues();
    components.push(...queueHealth);

    // Determine overall status
    const unhealthyCount = components.filter((c) => c.status === 'unhealthy').length;
    const degradedCount = components.filter((c) => c.status === 'degraded').length;

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000), // Uptime in seconds
      version: '1.0.0',
      components,
    };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      // Simple query to check database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - startTime;

      return {
        name: 'database',
        status: latency < 100 ? 'healthy' : latency < 500 ? 'degraded' : 'unhealthy',
        latency,
        message: latency < 100 ? 'Connected' : 'Slow response',
      };
    } catch (error: any) {
      return {
        name: 'database',
        status: 'unhealthy',
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      const client = this.redis.getClient();
      if (!client) {
        return {
          name: 'redis',
          status: 'unhealthy',
          message: 'Redis client not available',
        };
      }

      // Simple ping to check connectivity
      await client.ping();
      const latency = Date.now() - startTime;

      return {
        name: 'redis',
        status: latency < 50 ? 'healthy' : latency < 200 ? 'degraded' : 'unhealthy',
        latency,
        message: latency < 50 ? 'Connected' : 'Slow response',
      };
    } catch (error: any) {
      return {
        name: 'redis',
        status: 'unhealthy',
        message: `Connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Check queue health
   */
  private async checkQueues(): Promise<ComponentHealth[]> {
    try {
      const queueHealths = await this.workerMonitoring.getQueueHealth();
      return queueHealths.map((qh) => ({
        name: `queue:${qh.queue}`,
        status: qh.healthy ? 'healthy' : 'unhealthy',
        message: qh.issues.length > 0 ? qh.issues.join(', ') : 'All queues healthy',
        details: {
          active: qh.active,
          waiting: qh.waiting,
          completed: qh.completed,
          failed: qh.failed,
          delayed: qh.delayed,
        },
      }));
    } catch (error: any) {
      return [
        {
          name: 'queues',
          status: 'unhealthy',
          message: `Failed to check queues: ${error.message}`,
        },
      ];
    }
  }

  /**
   * Get simple health check (for load balancers)
   * Returns 200 OK if all critical components are healthy
   */
  async getSimpleHealth(): Promise<{ status: string; timestamp: string }> {
    const health = await this.getHealthStatus();
    return {
      status: health.status === 'healthy' ? 'ok' : 'degraded',
      timestamp: health.timestamp,
    };
  }
}

