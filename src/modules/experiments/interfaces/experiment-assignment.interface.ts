/**
 * Experiment Assignment Interface
 *
 * This file defines interfaces for experiment variant assignment.
 * Used for A/B testing of different strategies (e.g., inventory reservation strategies).
 *
 * Purpose:
 * - Deterministic variant assignment (same subject always gets same variant)
 * - Track experiment assignments
 * - Support A/B testing framework
 */

/**
 * Experiment configuration
 */
export interface ExperimentConfig {
  /**
   * Experiment key (e.g., "inventory.reservation_strategy")
   */
  key: string;

  /**
   * Experiment name
   */
  name: string;

  /**
   * Available variants (e.g., ["optimistic", "pessimistic"])
   */
  variants: string[];

  /**
   * Sampling rate (0.0 to 1.0)
   * 1.0 = 100% of subjects participate
   * 0.5 = 50% of subjects participate
   */
  sampling: number;

  /**
   * Experiment status
   */
  status: 'active' | 'paused' | 'completed';
}

/**
 * Experiment assignment result
 */
export interface ExperimentAssignment {
  /**
   * Experiment key
   */
  experimentKey: string;

  /**
   * Assigned variant
   */
  variant: string;

  /**
   * Whether subject is in experiment (based on sampling)
   */
  inExperiment: boolean;
}

