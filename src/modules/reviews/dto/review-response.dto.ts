/**
 * Review Response DTO
 *
 * DTO for review responses.
 */

export class ReviewResponseDto {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  comment?: string;
  moderated: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

