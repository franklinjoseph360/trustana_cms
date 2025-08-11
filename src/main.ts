import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { All, ValidationPipe } from '@nestjs/common';
import 'reflect-metadata';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/AllExceptionsFilter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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