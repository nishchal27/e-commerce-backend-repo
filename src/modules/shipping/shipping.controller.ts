/**
 * Shipping Controller
 *
 * HTTP endpoints for shipping operations.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RequestWithId } from '../../common/middleware/request-id.middleware';

@UseGuards(JwtAuthGuard)
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  /**
   * GET /shipping/orders/:orderId/rates
   * Get shipping rates for an order
   */
  @Get('orders/:orderId/rates')
  async getRates(
    @Param('orderId') orderId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: RequestWithId,
  ) {
    return this.shippingService.getRates(orderId, user.sub, req.requestId, req.traceId);
  }

  /**
   * POST /shipping/orders/:orderId/shipments
   * Create a shipment for an order (admin/manager only)
   */
  @Post('orders/:orderId/shipments')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async createShipment(
    @Param('orderId') orderId: string,
    @Body('service') service: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: RequestWithId,
  ) {
    return this.shippingService.createShipment(
      orderId,
      service,
      user.sub,
      req.requestId,
      req.traceId,
    );
  }

  /**
   * GET /shipping/track/:trackingNumber
   * Track a shipment
   */
  @Get('track/:trackingNumber')
  async trackShipment(@Param('trackingNumber') trackingNumber: string) {
    return this.shippingService.trackShipment(trackingNumber);
  }
}

