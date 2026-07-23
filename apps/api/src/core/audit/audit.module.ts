import { Module } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { createAuditExtension } from './audit.extension';
import { AUDITED_PRISMA } from './audited-prisma';

/**
 * Audit logging module.
 *
 * Exports:
 *  - AuditService    — explicit `log()` path for business transitions + the read
 *                      helper used by AuditController.
 *  - AUDITED_PRISMA  — a Prisma client with the automatic before/after audit
 *                      extension applied (shares PrismaService's connection).
 *                      Later modules inject this to get auto-audited writes on
 *                      auditable models (see audit.extension.ts).
 *
 * PrismaModule is @Global, so importing it here is not strictly required, but is
 * kept explicit per the module's dependency on PrismaService. ClsService is
 * provided by the global ClsModule (mounted in AppModule).
 */
@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    {
      provide: AUDITED_PRISMA,
      inject: [PrismaService, AuditService, ClsService],
      useFactory: (prisma: PrismaService, audit: AuditService, cls: ClsService) =>
        createAuditExtension(prisma, audit, cls),
    },
  ],
  exports: [AuditService, AUDITED_PRISMA],
})
export class AuditModule {}
