/**
 * Outbox Metrics Service
 *
 * This service periodically collects outbox metrics and updates Prometheus gauges.
 * It monitors the outbox backlog size and provides metrics for monitoring.
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../lib/prisma/prisma.service';
import { PrometheusService } from '../../prometheus/prometheus.service';
import { Logger } from '../../../lib/logger';

@Injectable()
export class OutboxMetricsService implements OnModuleInit, OnModuleDestroy {
  private metricsInterval: NodeJS.Timeout | null = null;
  private readonly pollingInterval: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly prometheusService: PrometheusService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.pollingInterval = this.configService.get<number>('OUTBOX_METRICS_INTERVAL', 30000); // 30 seconds
  }

  async onModuleInit() {
    this.startMetricsCollection();
    this.logger.log('OutboxMetricsService initialized', 'OutboxMetricsService');
  }

  async onModuleDestroy() {
    this.stopMetricsCollection();
    this.logger.log('OutboxMetricsService destroyed', 'OutboxMetricsService');
  }

  private startMetricsCollection() {
    this.metricsInterval = setInterval(
      () => this.collectMetrics(),
      this.pollingInterval,
    );
  }

  private stopMetricsCollection() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  private async collectMetrics() {
    try {
      // Count unsent events in outbox
      const unsentCount = await (this.prisma as any).outbox.count({
        where: {
          sentAt: null,
          locked: false,
        },
      });

      // Update Prometheus gauge
      this.prometheusService.updateOutboxBacklogSize(unsentCount);

      this.logger.debug(
        `Outbox backlog size: ${unsentCount} unsent events`,
        'OutboxMetricsService',
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to collect outbox metrics: ${error.message}`,
        error.stack,
        'OutboxMetricsService',
      );
    }
  }
}

