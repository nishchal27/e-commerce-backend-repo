/**
 * Audit Log Interceptor
 *
 * Automatically logs audit events for controller methods.
 * Can be applied globally or to specific controllers.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService, AuditAction, AuditResource } from '../audit-log.service';
import { RequestWithId } from '../../middleware/request-id.middleware';

/**
 * Map HTTP methods to audit actions
 */
function getAuditAction(method: string): AuditAction {
  switch (method.toUpperCase()) {
    case 'POST':
      return AuditAction.CREATE;
    case 'PATCH':
    case 'PUT':
      return AuditAction.UPDATE;
    case 'DELETE':
      return AuditAction.DELETE;
    case 'GET':
      return AuditAction.READ;
    default:
      return AuditAction.READ;
  }
}

/**
 * Map route paths to audit resources
 */
function getAuditResource(path: string): AuditResource {
  if (path.includes('/orders')) return AuditResource.ORDER;
  if (path.includes('/payments')) return AuditResource.PAYMENT;
  if (path.includes('/products')) return AuditResource.PRODUCT;
  if (path.includes('/reviews')) return AuditResource.REVIEW;
  if (path.includes('/inventory')) return AuditResource.INVENTORY;
  if (path.includes('/cart')) return AuditResource.CART;
  if (path.includes('/users') || path.includes('/admin')) return AuditResource.USER;
  return AuditResource.USER; // Default
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const response = context.switchToHttp().getResponse();
    const method = request.method;
    const path = request.route?.path || request.path;

    const action = getAuditAction(method);
    const resource = getAuditResource(path);
    const userId = (request as any).user?.sub;
    const resourceId = request.params?.id;

    // Extract IP and user agent
    const forwardedFor = request.headers['x-forwarded-for'];
    const ipAddress =
      request.ip ||
      (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) ||
      request.connection.remoteAddress;
    const userAgent = Array.isArray(request.headers['user-agent'])
      ? request.headers['user-agent'][0]
      : request.headers['user-agent'];

    return next.handle().pipe(
      tap({
        next: () => {
          // Log successful operation
          this.auditLogService.logAccess(
            userId,
            action,
            resource,
            true,
            ipAddress,
            userAgent,
            undefined,
            request.requestId,
            request.traceId,
          );
        },
        error: (error) => {
          // Log failed operation
          this.auditLogService.logAccess(
            userId,
            action,
            resource,
            false,
            ipAddress,
            userAgent,
            error.message,
            request.requestId,
            request.traceId,
          );
        },
      }),
    );
  }
}

