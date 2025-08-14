import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/AllExceptionsFilter';
import { PrismaExceptionFilter } from './common/filters/PrismaExceptionFilter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.useLogger(['log', 'error', 'warn', 'debug', 'verbose']);

  process.on('uncaughtException', err => console.error('[uncaughtException]', err));
  process.on('unhandledRejection', err => console.error('[unhandledRejection]', err));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new PrismaExceptionFilter(), new AllExceptionsFilter());

  // One CORS config for all environments
  const fromEnv =
    process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
  const ALLOWLIST = new Set([
    ...fromEnv,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    // add your frontend prod origin here if you want a strict list:
    // 'https://trustana-cms.vercel.app',
    // Swagger UI origin will be your API Gateway URL. If you keep the list empty, we reflect any origin below.
  ]);

  app.enableCors({
    origin(origin, cb) {
      // Allow server-to-server and same-origin requests
      if (!origin) return cb(null, true);
      // If no allowlist provided, reflect the request origin to support Swagger and any frontend
      if (ALLOWLIST.size === 0) return cb(null, true);
      cb(null, ALLOWLIST.has(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client-ID'],
    exposedHeaders: ['Content-Length', 'Content-Range'],
    credentials: true, // set to false if you never use cookies
    maxAge: 86400,
  });

  const config = new DocumentBuilder()
    .setTitle('Trustana Attributes API')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  app.getHttpAdapter().getInstance().get('/__health', (_req, res) => res.json({ ok: true }));

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  Logger.log(`HTTP server listening on ${port}`);
}

bootstrap();
