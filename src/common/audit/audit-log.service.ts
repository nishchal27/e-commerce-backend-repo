/**
 * Audit Log Service
 *
 * This service provides audit logging functionality for compliance and security.
 * It logs all critical operations (user actions, data changes, access attempts).
 *
 * Responsibilities:
 * - Log user actions (create, update, delete operations)
 * - Log access attempts (login, authorization failures)
 * - Log data changes (who changed what and when)
 * - Provide audit trail for compliance
 *
 * Features:
 * - Immutable audit logs (append-only)
 * - Structured logging format
 * - Searchable by user, action, resource
 * - Integration with event system
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { OutboxService } from '../events/outbox.service';
import { Logger } from '../../lib/logger';
import { v4 as uuidv4 } from 'uuid';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  READ = 'READ',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  AUTHORIZE = 'AUTHORIZE',
  UNAUTHORIZED = 'UNAUTHORIZED',
}

export enum AuditResource {
  USER = 'USER',
  ORDER = 'ORDER',
  PAYMENT = 'PAYMENT',
  PRODUCT = 'PRODUCT',
  REVIEW = 'REVIEW',
  INVENTORY = 'INVENTORY',
  CART = 'CART',
}

export interface AuditLogData {
  userId?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly logger: Logger,
  ) {}

  /**
   * Log an audit event
   *
   * @param data - Audit log data
   * @param requestId - Optional request ID for correlation
   * @param traceId - Optional trace ID for distributed tracing
   */
  async log(
    data: AuditLogData,
    requestId?: string,
    traceId?: string,
  ): Promise<void> {
    try {
      // Write to database (if audit_logs table exists)
      // For now, we'll emit an event and log it
      const auditEvent = {
        audit_id: uuidv4(),
        timestamp: new Date().toISOString(),
        ...data,
      };

      // Emit audit event via outbox
      await this.outboxService.writeEvent({
        topic: 'audit.log',
        event: this.outboxService.createEvent(
          'audit.log.v1',
          auditEvent,
          {
            request_id: requestId,
            trace_id: traceId,
          },
        ),
      });

      // Also log to application logs
      this.logger.log(
        {
          audit_id: auditEvent.audit_id,
          action: data.action,
          resource: data.resource,
          resource_id: data.resourceId,
          user_id: data.userId,
          success: data.success,
          ip_address: data.ipAddress,
        },
        'AuditLogService',
      );
    } catch (error: any) {
      // Don't throw - audit logging should never break the main flow
      this.logger.error(
        `Failed to log audit event: ${error.message}`,
        error.stack,
        'AuditLogService',
      );
    }
  }

  /**
   * Log a successful action
   */
  async logSuccess(
    userId: string | undefined,
    action: AuditAction,
    resource: AuditResource,
    resourceId: string | undefined,
    details?: Record<string, any>,
    requestId?: string,
    traceId?: string,
  ): Promise<void> {
    await this.log(
      {
        userId,
        action,
        resource,
        resourceId,
        details,
        success: true,
      },
      requestId,
      traceId,
    );
  }

  /**
   * Log a failed action
   */
  async logFailure(
    userId: string | undefined,
    action: AuditAction,
    resource: AuditResource,
    resourceId: string | undefined,
    errorMessage: string,
    details?: Record<string, any>,
    requestId?: string,
    traceId?: string,
  ): Promise<void> {
    await this.log(
      {
        userId,
        action,
        resource,
        resourceId,
        details,
        success: false,
        errorMessage,
      },
      requestId,
      traceId,
    );
  }

  /**
   * Log an access attempt
   */
  async logAccess(
    userId: string | undefined,
    action: AuditAction,
    resource: AuditResource,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorMessage?: string,
    requestId?: string,
    traceId?: string,
  ): Promise<void> {
    await this.log(
      {
        userId,
        action,
        resource,
        success,
        ipAddress,
        userAgent,
        errorMessage,
      },
      requestId,
      traceId,
    );
  }
}

