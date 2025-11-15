/**
 * Recommendation Strategy Interface
 *
 * Defines the interface for recommendation algorithms.
 * Different strategies can be implemented and swapped via dependency injection.
 */

export interface RecommendationResult {
  productId: string;
  score: number; // Recommendation score (0-1, higher is better)
  reason?: string; // Reason for recommendation (e.g., "popular", "similar", "co-occurrence")
}

export interface RecommendationOptions {
  productId?: string; // For product-based recommendations
  userId?: string; // For user-based recommendations
  limit?: number; // Maximum number of recommendations (default: 10)
  excludeProductIds?: string[]; // Product IDs to exclude from results
}

export interface IRecommendationStrategy {
  /**
   * Name of the recommendation strategy
   */
  name: string;

  /**
   * Get product recommendations.
   *
   * @param options - Recommendation options
   * @returns Array of recommended products with scores
   */
  getRecommendations(options: RecommendationOptions): Promise<RecommendationResult[]>;
}

