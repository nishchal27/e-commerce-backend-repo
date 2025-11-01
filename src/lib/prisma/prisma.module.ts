/**
 * Prisma Module
 *
 * This module provides Prisma Client as a global service for database access.
 * Prisma is a modern TypeScript ORM that provides type-safe database queries.
 *
 * Usage:
 * - Import PrismaModule in any module that needs database access
 * - Inject PrismaService into services/controllers
 * - Use PrismaService.prisma to access Prisma Client methods
 */

import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global Prisma module that provides database access throughout the application.
 * Marked as Global so PrismaService doesn't need to be imported in every module.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

