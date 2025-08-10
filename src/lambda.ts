// src/lambda.ts
import 'source-map-support/register'
import 'reflect-metadata'
import { Handler } from 'aws-lambda'
import serverlessExpress from '@vendia/serverless-express'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ExpressAdapter } from '@nestjs/platform-express'
import express from 'express'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

let cached: Handler | null = null

async function bootstrap(): Promise<Handler> {
  const expressApp = express()
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { bufferLogs: true })

  app.enableCors()

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  const config = new DocumentBuilder()
    .setTitle('Trustana - Attributes API')
    .setVersion('1.0.0')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: false,
    swaggerOptions: { persistAuthorization: true },
  })

  await app.init()
  return serverlessExpress({ app: expressApp })
}

export const handler: Handler = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false
  if (!cached) cached = await bootstrap()
  return cached(event, context, callback)
}
