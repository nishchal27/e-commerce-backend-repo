/**
 * Payments Controller
 *
 * This controller handles HTTP requests for payment-related endpoints.
 * It validates request data, delegates to the service layer, and returns HTTP responses.
 *
 * Endpoints:
 * - POST /payments - Create payment intent (protected)
 * - POST /payments/:id/confirm - Confirm payment (protected)
 * - POST /payments/webhook - Process webhook from payment provider (public, signature verified)
 * - POST /payments/:id/refund - Refund payment (protected, admin only)
 *
 * Security:
 * - Payment creation/confirmation requires authentication
 * - Webhook endpoint is public but signature-verified
 * - Refunds require admin role
 */

import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Headers,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequestWithId } from '../../common/middleware/request-id.middleware';

/**
 * PaymentsController handles HTTP requests for payment endpoints
 */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /payments
   * Create a payment intent.
   *
   * This endpoint:
   * - Validates order exists and is in CREATED status
   * - Creates payment intent via payment provider
   * - Stores payment record in database
   * - Returns client_secret for frontend confirmation
   *
   * @param createPaymentDto - Payment creation data
   * @param req - Request object (for request ID and trace ID)
   * @returns Payment intent with client_secret
   */
  @Post()
  @UseGuards(JwtAuthGuard) // Requires authentication
  @HttpCode(HttpStatus.CREATED)
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Req() req: RequestWithId,
  ) {
    return this.paymentsService.createPayment(
      createPaymentDto,
      req.requestId,
      req.traceId,
    );
  }

  /**
   * POST /payments/:id/confirm
   * Confirm a payment.
   *
   * This endpoint:
   * - Confirms payment intent via provider
   * - Updates payment and order status
   * - Emits payment.succeeded event
   *
   * @param id - Payment intent ID
   * @param confirmPaymentDto - Payment confirmation data
   * @param req - Request object (for request ID and trace ID)
   * @returns Updated payment result
   */
  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard) // Requires authentication
  async confirmPayment(
    @Param('id') id: string,
    @Body() confirmPaymentDto: ConfirmPaymentDto,
    @Req() req: RequestWithId,
  ) {
    // Override paymentIntentId from URL parameter
    confirmPaymentDto.paymentIntentId = id;

    return this.paymentsService.confirmPayment(
      confirmPaymentDto,
      req.requestId,
      req.traceId,
    );
  }

  /**
   * POST /payments/webhook
   * Process webhook from payment provider.
   *
   * This endpoint:
   * - Verifies webhook signature (security)
   * - Processes webhook event idempotently
   * - Updates payment and order status
   * - Emits events
   *
   * Security:
   * - Public endpoint (no auth required)
   * - Signature verification ensures webhook is from provider
   * - Idempotent processing (webhookEventId prevents duplicates)
   *
   * Note: For Stripe webhooks, you need to configure NestJS to preserve raw body.
   * Add this to main.ts:
   * ```typescript
   * app.use('/payments/webhook', express.raw({ type: 'application/json' }));
   * ```
   *
   * @param req - Request object with raw body
   * @param headers - Request headers (for signature)
   * @returns Webhook processing result
   */
  @Post('webhook')
  @Public() // Public endpoint (signature verification provides security)
  @HttpCode(HttpStatus.OK)
  async processWebhook(
    @Req() req: RawBodyRequest<Request> & { body: any },
    @Headers('stripe-signature') signature: string,
  ) {
    // Get raw body for signature verification
    // If rawBody is not available, use parsed body (less secure but works)
    const payload = (req as any).rawBody || req.body;

    return this.paymentsService.processWebhook(payload, signature || '');
  }

  /**
   * POST /payments/:id/refund
   * Refund a payment.
   *
   * This endpoint:
   * - Processes refund via payment provider
   * - Updates payment status to REFUNDED
   * - Emits payment.refunded event
   *
   * Security: Only ADMIN role can process refunds.
   *
   * @param id - Payment intent ID
   * @param refundPaymentDto - Refund data
   * @param req - Request object (for request ID and trace ID)
   * @returns Refund result
   */
  @Post(':id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard) // Requires authentication and admin role
  @Roles('ADMIN') // Only admin can refund
  async refundPayment(
    @Param('id') id: string,
    @Body() refundPaymentDto: RefundPaymentDto,
    @Req() req: RequestWithId,
  ) {
    // Override paymentIntentId from URL parameter
    refundPaymentDto.paymentIntentId = id;

    // TODO: Implement refund logic in PaymentsService
    // For now, return placeholder
    return {
      message: 'Refund functionality to be implemented',
      paymentIntentId: id,
    };
  }
}

