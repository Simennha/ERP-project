import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Parse cookies so the refresh strategy can read the httpOnly refresh cookie.
  app.use(cookieParser());

  // Allow the Next.js dev origin and send/receive cookies.
  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000',
    credentials: true,
  });

  // Global validation (class-validator DTOs). Auth DTOs use ZodValidationPipe
  // at the parameter level; the two coexist (see zod-validation.pipe.ts).
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );

  // Consistent JSON error shape for every thrown error.
  app.useGlobalFilters(new AllExceptionsFilter());

  // --- Real-time (LATER PHASE) ---------------------------------------------
  // The default Express HTTP adapter is used here on purpose: a Socket.io
  // gateway backed by Redis pub/sub can be attached in a later phase (e.g. an
  // EventsModule with @WebSocketGateway) without changing this bootstrap.
  // No server restructuring is required at that point.

  const port = Number(config.get<string>('PORT') ?? '3001');
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`ERP API listening on http://localhost:${port}`);
}

void bootstrap();
