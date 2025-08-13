import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import 'reflect-metadata';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const isProd = process.env.NODE_ENV === 'production';
  const corsOrigins = process.env.CORS_ORIGINS
    ?.split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (!isProd) {
    // Dev CORS
    app.enableCors({
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
      maxAge: 86400,
    });
  } else if (corsOrigins?.length) {
    // Prod CORS driven by env
    app.enableCors({
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
      maxAge: 86400,
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,                // strips unknown fields
      forbidNonWhitelisted: true,     // 400 if unknown fields are sent
      transform: true,                // enables class-transformer
      transformOptions: {
        enableImplicitConversion: true, // coerce query params (e.g., page=1)
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Trustana - Attributes API')
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(3000);
}

bootstrap();