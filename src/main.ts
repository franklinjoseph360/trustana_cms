import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/AllExceptionsFilter';
import { PrismaExceptionFilter } from './common/filters/PrismaExceptionFilter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.useLogger(['log', 'error', 'warn', 'debug', 'verbose']);

  // catch truly uncaught errors
  process.on('uncaughtException', err => {
    // eslint-disable-next-line no-console
    console.error('[uncaughtException]', err);
  });
  process.on('unhandledRejection', err => {
    // eslint-disable-next-line no-console
    console.error('[unhandledRejection]', err);
  });

  // global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // exception filters
  app.useGlobalFilters(
    new PrismaExceptionFilter(),
    new AllExceptionsFilter(),
  );

  // cors
  const isProd = process.env.NODE_ENV === 'production';
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean);
  if (!isProd) {
    app.enableCors({
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
      maxAge: 86400,
    });
  } else if (corsOrigins?.length) {
    app.enableCors({
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
      maxAge: 86400,
    });
  }

  // swagger
  const config = new DocumentBuilder()
    .setTitle('Trustana Attributes API')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // optional quick health check
  app.getHttpAdapter().getInstance().get('/__health', (_req, res) => res.json({ ok: true }));

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  Logger.log(`HTTP server listening on ${port}`);
}

bootstrap();
