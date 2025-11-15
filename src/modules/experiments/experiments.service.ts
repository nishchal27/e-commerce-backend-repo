/**
 * Experiments Service
 *
 * This service handles experiment management and variant assignment for A/B testing.
 * It provides deterministic variant assignment and tracks experiment assignments.
 *
 * Responsibilities:
 * - Experiment configuration management
 * - Deterministic variant assignment (hash-based)
 * - Experiment assignment tracking
 * - Integration with Outbox for experiment events
 *
 * Key Features:
 * - Deterministic assignment (same subject always gets same variant)
 * - Sampling support (control experiment participation)
 * - Experiment status management (active, paused, completed)
 * - Event emission for experiment tracking
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { CreateExperimentDto } from './dto/create-experiment.dto';
import {
  ExperimentConfig,
  ExperimentAssignment,
} from './interfaces/experiment-assignment.interface';
import { OutboxService } from '../../common/events/outbox.service';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { Logger } from '../../lib/logger';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * ExperimentsService handles experiment management and variant assignment
 */
@Injectable()
export class ExperimentsService {
  // In-memory cache of experiment configs (key -> config)
  // In production, this could be backed by Redis or database
  private experimentConfigs: Map<string, ExperimentConfig> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly logger: Logger,
  ) {
    // Initialize default experiments
    this.initializeDefaultExperiments();
  }

  /**
   * Initialize default experiments.
   * In production, these would be loaded from database.
   */
  private initializeDefaultExperiments(): void {
    // Inventory reservation strategy experiment
    this.experimentConfigs.set('inventory.reservation_strategy', {
      key: 'inventory.reservation_strategy',
      name: 'Inventory Reservation Strategy',
      variants: ['optimistic', 'pessimistic'],
      sampling: 1.0, // 100% participation
      status: 'active',
    });

    this.logger.log(
      'Default experiments initialized',
      'ExperimentsService',
    );
  }

  /**
   * Get experiment configuration.
   *
   * @param key - Experiment key
   * @returns Experiment config or null if not found
   */
  getExperimentConfig(key: string): ExperimentConfig | null {
    return this.experimentConfigs.get(key) || null;
  }

  /**
   * Assign variant to a subject deterministically.
   *
   * Algorithm:
   * 1. Hash experiment key + subject ID (deterministic)
   * 2. Check sampling rate (determine if subject participates)
   * 3. If in experiment, assign variant based on hash
   * 4. Return assignment result
   *
   * @param experimentKey - Experiment key
   * @param subjectId - Subject ID (user ID, session ID, etc.)
   * @param subjectType - Subject type (e.g., "user", "session")
   * @returns Experiment assignment
   */
  assignVariant(
    experimentKey: string,
    subjectId: string,
    subjectType: string = 'user',
  ): ExperimentAssignment {
    const config = this.getExperimentConfig(experimentKey);

    if (!config || config.status !== 'active') {
      // Experiment not found or not active, return default
      return {
        experimentKey,
        variant: 'default',
        inExperiment: false,
      };
    }

    // Deterministic hash-based assignment
    const hash = crypto
      .createHash('sha256')
      .update(`${experimentKey}:${subjectId}`)
      .digest('hex');

    // Check sampling (first 8 hex chars as number, mod 100)
    const samplingHash = parseInt(hash.slice(0, 8), 16) % 100;
    const inExperiment = samplingHash < config.sampling * 100;

    if (!inExperiment) {
      return {
        experimentKey,
        variant: 'default',
        inExperiment: false,
      };
    }

    // Assign variant based on hash
    const variantIndex = parseInt(hash.slice(8, 16), 16) % config.variants.length;
    const variant = config.variants[variantIndex];

    // Track assignment (async, don't block)
    this.trackAssignment(experimentKey, subjectId, subjectType, variant).catch(
      (error) => {
        this.logger.error(
          `Failed to track experiment assignment: ${error.message}`,
          error.stack,
          'ExperimentsService',
        );
      },
    );

    return {
      experimentKey,
      variant,
      inExperiment: true,
    };
  }

  /**
   * Track experiment assignment.
   *
   * This method:
   * 1. Stores assignment in database (if ExperimentAssignment table exists)
   * 2. Emits experiment.impression event via Outbox
   *
   * @param experimentKey - Experiment key
   * @param subjectId - Subject ID
   * @param subjectType - Subject type
   * @param variant - Assigned variant
   */
  private async trackAssignment(
    experimentKey: string,
    subjectId: string,
    subjectType: string,
    variant: string,
  ): Promise<void> {
    // Emit experiment.impression event
    await this.outboxService.writeEvent({
      topic: 'experiment.impression',
      event: this.outboxService.createEvent(
        'experiment.impression.v1',
        {
          experiment_key: experimentKey,
          subject_id: subjectId,
          subject_type: subjectType,
          variant,
        },
        'experiments-service',
      ),
    });

    this.logger.debug(
      `Experiment assignment tracked: ${experimentKey} -> ${variant} (subject: ${subjectId})`,
      'ExperimentsService',
    );
  }

  /**
   * Record experiment conversion/outcome.
   *
   * This method emits an experiment.conversion event when an outcome occurs.
   * Used to track when a subject performs an action (e.g., successful reservation).
   *
   * @param experimentKey - Experiment key
   * @param subjectId - Subject ID
   * @param variant - Variant that was assigned
   * @param outcome - Outcome name (e.g., "reservation_success", "reservation_failure")
   * @param metadata - Additional metadata (e.g., latency, error details)
   */
  async recordConversion(
    experimentKey: string,
    subjectId: string,
    variant: string,
    outcome: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.outboxService.writeEvent({
      topic: 'experiment.conversion',
      event: this.outboxService.createEvent(
        'experiment.conversion.v1',
        {
          experiment_key: experimentKey,
          subject_id: subjectId,
          variant,
          outcome,
          ...metadata,
        },
        'experiments-service',
      ),
    });

    this.logger.debug(
      `Experiment conversion recorded: ${experimentKey} -> ${variant} -> ${outcome} (subject: ${subjectId})`,
      'ExperimentsService',
    );
  }

  /**
   * Create experiment result (for k6/load testing results).
   * This is the original method for storing experiment results.
   *
   * @param dto - Create experiment DTO
   */
  async create(dto: CreateExperimentDto) {
    return this.prisma.experiment.create({
      data: {
        name: dto.name,
        description: dto.notes || '',
        variant: 'baseline',
        metric: 'avg_response_time',
        value: new Decimal(dto.metricsSummary.avg_ms || 0),
        metadata: dto.rawFile ? JSON.parse(dto.rawFile) : null,
      } as unknown as Prisma.ExperimentCreateInput,
    });
  }
}
