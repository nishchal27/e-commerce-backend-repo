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
  facets?: SearchFacets; // Available filter options with counts
}

export interface SearchFilters {
  categoryId?: string;
  brandId?: string;
  gender?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sizes?: string[];
  colors?: string[];
  attributes?: Record<string, any>;
}

/**
 * Facets for faceted search
 * Provides available filter options and counts
 */
export interface SearchFacets {
  categories?: Array<{ id: string; name: string; count: number }>;
  brands?: Array<{ id: string; name: string; count: number }>;
  genders?: Array<{ value: string; count: number }>;
  sizes?: Array<{ value: string; count: number }>;
  colors?: Array<{ value: string; count: number }>;
  priceRange?: {
    min: number;
    max: number;
  };
}

