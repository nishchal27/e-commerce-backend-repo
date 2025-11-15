/**
 * Search Result Interface
 *
 * Defines the structure of search results returned by the search service.
 */

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  slug: string;
  categoryId?: string;
  relevanceScore?: number; // Full-text search relevance score
  variants?: {
    id: string;
    sku: string;
    price: number;
    currency: string;
    stock: number;
    attributes?: Record<string, any>;
  }[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  query: string;
  filters?: Record<string, any>;
}

export interface SearchFilters {
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  attributes?: Record<string, any>;
}

