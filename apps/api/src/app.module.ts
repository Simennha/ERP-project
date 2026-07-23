import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClsModule } from 'nestjs-cls';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { EventBusModule } from './core/event-bus/event-bus.module';
import { AuditModule } from './core/audit/audit.module';
import { NotificationsModule } from './core/notifications/notifications.module';
import { WorkflowModule } from './core/workflow/workflow.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    // Loads the single root .env (API is started from apps/api, so ../../.env).
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    // Request-scoped context (userId/companyId). Middleware is auto-mounted so
    // the context is active through guards, strategies, services, and handlers.
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    // Global EventEmitter2 instance backing the event bus (core/event-bus).
    // Wildcard mode is required for RealtimeGateway's `@OnEvent('**')` catch-all.
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    PrismaModule,
    UsersModule,
    AuthModule,
    EventBusModule,
    AuditModule,
    NotificationsModule,
    WorkflowModule,
    InventoryModule,
    SalesModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    // Global guards. Registration order is significant: authenticate first
    // (JwtAuthGuard), then authorize (PermissionsGuard).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
