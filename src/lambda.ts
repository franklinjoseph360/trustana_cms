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
import { AllExceptionsFilter } from './common/filters/AllExceptionsFilter'
import { PrismaExceptionFilter } from './common/filters/PrismaExceptionFilter'
import { corsOptions } from './common/cors.options'

let cached: Handler | null = null

async function bootstrap(): Promise<Handler> {
  const expressApp = express()
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { bufferLogs: true, logger: false }, // logger off, we log to stderr ourselves
  )
  app.enableCors(corsOptions);

  // Helpful for API Gateway preflight
  expressApp.options(/.*/, (_req, res) => res.sendStatus(204));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // Register the global exception filter so errors are logged to stderr
  app.useGlobalFilters(
    new PrismaExceptionFilter(),
    new AllExceptionsFilter(),
  );

  // Swagger
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

  // One line on cold start so you can confirm logs are flowing
  try {
    console.error(JSON.stringify({ level: 'info', ts: new Date().toISOString(), msg: 'Lambda cold start ready' }))
  } catch { }

  return serverlessExpress({ app: expressApp })
}

export const handler: Handler = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false

  // Process level error logging for anything outside Nest
  if (!cached) {
    process.on('unhandledRejection', (reason, p) => {
      try {
        console.error(
          JSON.stringify({
            level: 'error',
            ts: new Date().toISOString(),
            type: 'unhandledRejection',
            reason,
            promise: String(p),
          }),
        )
      } catch {
        console.error('unhandledRejection')
      }
    })

    process.on('uncaughtException', (err: any) => {
      try {
        console.error(
          JSON.stringify({
            level: 'error',
            ts: new Date().toISOString(),
            type: 'uncaughtException',
            message: err?.message,
            stack: err?.stack,
          }),
        )
      } catch {
        console.error('uncaughtException')
      }
    })

    cached = await bootstrap()
  }

  return cached(event, context, callback)
}
