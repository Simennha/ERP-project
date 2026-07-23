import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RedisIoAdapter } from './core/event-bus/redis-io.adapter';

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

  // --- Real-time (Phase 2 event bus) ---------------------------------------
  // Attach the Socket.io adapter backed by a Redis pub/sub pair so WebSocket
  // room broadcasts fan out across API instances. connectToRedis() degrades
  // gracefully to the in-memory adapter when Redis is unavailable (dev), so it
  // must run before useWebSocketAdapter() and before app.listen() binds the
  // RealtimeGateway. The HTTP Express adapter is untouched — Socket.io shares
  // the same underlying HTTP server.
  const redisIoAdapter = new RedisIoAdapter(app, config);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const port = Number(config.get<string>('PORT') ?? '3001');
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`ERP API listening on http://localhost:${port}`);
}

void bootstrap();
