/**
 * Shipping Module
 *
 * Provides shipping functionality with provider abstraction.
 */

import { Module } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { MockShippingProvider } from './providers/mock-shipping.provider';
import { PrismaModule } from '../../lib/prisma/prisma.module';
import { EventsModule } from '../../common/events/events.module';
import { AuditLogModule } from '../../common/audit/audit-log.module';
import { LoggerModule } from '../../lib/logger/logger.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    AuditLogModule,
    LoggerModule,
    ConfigModule,
  ],
  controllers: [ShippingController],
  providers: [ShippingService, MockShippingProvider],
  exports: [ShippingService],
})
export class ShippingModule {}

