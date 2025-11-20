/**
 * Return Response DTO
 *
 * DTO for return API responses.
 */

import { ReturnStatus, ReturnReason } from '@prisma/client';

/**
 * Return item in response
 */
export class ReturnItemResponseDto {
  id: string;
  returnId: string;
  orderItemId: string;
  variantId: string;
  quantity: number;
  reason: ReturnReason | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Return response structure
 */
export class ReturnResponseDto {
  id: string;
  orderId: string;
  userId: string;
  returnNumber: string; // RMA number (e.g., "RMA-2024-001")
  status: ReturnStatus;
  reason: ReturnReason;
  reasonDetails: string | null;
  refundAmount: number | null;
  notes: string | null;
  items: ReturnItemResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

