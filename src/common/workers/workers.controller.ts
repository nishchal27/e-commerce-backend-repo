/**
 * Workers Controller
 *
 * This controller provides HTTP endpoints for worker monitoring and health checks.
 * It exposes queue health status and worker metrics.
 *
 * Endpoints:
 * - GET /workers/health - Get health status for all queues
 * - GET /workers/health/:queue - Get health status for specific queue
 *
 * Security:
 * - All endpoints require authentication
 * - Admin role recommended for monitoring endpoints
 */

import { Controller, Get, Param, Post, Delete, UseGuards, Query, ParseIntPipe } from '@nestjs/common';
import { WorkerMonitoringService, QueueHealth } from './services/worker-monitoring.service';
import { DLQHandlerService } from './services/dlq-handler.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';

/**
 * WorkersController handles HTTP requests for worker monitoring
 */
@Controller('workers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER') // Only admins and managers can access worker endpoints
export class WorkersController {
  constructor(
    private readonly workerMonitoringService: WorkerMonitoringService,
    private readonly dlqHandlerService: DLQHandlerService,
  ) {}

  /**
   * GET /workers/health
   * Get health status for all queues.
   *
   * @returns Array of queue health statuses
   */
  @Get('health')
  async getHealth(): Promise<{ queues: QueueHealth[]; overall: 'healthy' | 'unhealthy' }> {
    const queues = await this.workerMonitoringService.getQueueHealth();

    // Determine overall health
    const overall = queues.every((q) => q.healthy) ? 'healthy' : 'unhealthy';

    return {
      queues,
      overall,
    };
  }

  /**
   * GET /workers/health/:queue
   * Get health status for a specific queue.
   *
   * @param queue - Queue name
   * @returns Queue health status
   */
  @Get('health/:queue')
  async getQueueHealth(@Param('queue') queue: string): Promise<QueueHealth | null> {
    return this.workerMonitoringService.getQueueHealthByName(queue);
  }

  /**
   * GET /workers/dlq/:queue
   * Get failed jobs (DLQ) for a specific queue.
   *
   * @param queue - Queue name
   * @param limit - Maximum number of jobs to return (default: 100)
   * @returns Array of failed job information
   */
  @Get('dlq/:queue')
  async getFailedJobs(
    @Param('queue') queue: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.dlqHandlerService.getFailedJobs(queue, limitNum);
  }

  /**
   * GET /workers/dlq
   * Get failed job counts for all queues.
   *
   * @returns Map of queue name to failed job count
   */
  @Get('dlq')
  async getFailedJobCounts() {
    const counts = await this.dlqHandlerService.getFailedJobCounts();
    return Object.fromEntries(counts);
  }

  /**
   * POST /workers/dlq/:queue/:jobId/retry
   * Retry a failed job.
   *
   * @param queue - Queue name
   * @param jobId - Job ID
   * @returns Success status
   */
  @Post('dlq/:queue/:jobId/retry')
  async retryFailedJob(@Param('queue') queue: string, @Param('jobId') jobId: string) {
    const success = await this.dlqHandlerService.retryJob(queue, jobId);
    return { success, message: `Job ${jobId} queued for retry` };
  }

  /**
   * DELETE /workers/dlq/:queue/:jobId
   * Remove a failed job (archive/delete).
   *
   * @param queue - Queue name
   * @param jobId - Job ID
   * @returns Success status
   */
  @Delete('dlq/:queue/:jobId')
  async removeFailedJob(@Param('queue') queue: string, @Param('jobId') jobId: string) {
    const success = await this.dlqHandlerService.removeFailedJob(queue, jobId);
    return { success, message: `Job ${jobId} removed from DLQ` };
  }
}

