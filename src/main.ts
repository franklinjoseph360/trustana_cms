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
  const ALLOWLIST: (string | RegExp)[] = [
    ...fromEnv,
    'https://trustana-cms.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    /\.vercel\.app$/i, // preview deploys
  ];

  function isAllowed(origin: string) {
    return ALLOWLIST.some(rule =>
      typeof rule === 'string' ? rule === origin : rule.test(origin)
    );
  }

  app.enableCors({
    origin(origin, cb) {
      // server-to-server or same-origin
      if (!origin) return cb(null, true);
      // if no allowlist provided, reflect any origin (Swagger-friendly)
      if (ALLOWLIST.length === 0) return cb(null, true);
      // allow or silently deny; DO NOT pass an Error here
      cb(null, isAllowed(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client-ID'],
    exposedHeaders: ['Content-Length', 'Content-Range'],
    credentials: false,          // set to true only if you really use cookies
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
