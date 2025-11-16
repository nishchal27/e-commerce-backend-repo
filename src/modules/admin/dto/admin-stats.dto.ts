/**
 * Admin Stats DTO
 *
 * DTO for admin dashboard statistics.
 */

export class AdminStatsDto {
  users: {
    total: number;
    active: number;
    byRole: Record<string, number>;
  };
  orders: {
    total: number;
    byStatus: Record<string, number>;
    revenue: number;
  };
  products: {
    total: number;
    lowStock: number;
  };
  reviews: {
    total: number;
    pendingModeration: number;
  };
  payments: {
    total: number;
    byStatus: Record<string, number>;
    revenue: number;
  };
}

