/**
 * Audit Log Module
 *
 * Provides audit logging functionality.
 */

import { Module, Global } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { PrismaModule } from '../../lib/prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { LoggerModule } from '../../lib/logger/logger.module';

@Global() // Make AuditLogService available globally
@Module({
  imports: [PrismaModule, EventsModule, LoggerModule],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}

