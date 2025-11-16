/**
 * Admin Module
 *
 * Provides administrative functionality with RBAC.
 */

import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../../lib/prisma/prisma.module';
import { AuditLogModule } from '../../common/audit/audit-log.module';
import { LoggerModule } from '../../lib/logger/logger.module';

@Module({
  imports: [PrismaModule, AuditLogModule, LoggerModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

