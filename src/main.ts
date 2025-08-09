import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import 'reflect-metadata';

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

  await app.listen(3000);
}
bootstrap();
