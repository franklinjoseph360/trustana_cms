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

let cached: Handler | null = null

// Build one allowlist
const fromEnv =
  process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) ?? []
const ALLOWLIST: (string | RegExp)[] = [
  ...fromEnv,
  'https://trustana-cms.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  /\.vercel\.app$/i, // preview deploys
  // Swagger runs on your API origin, so if the list is empty we will reflect any origin below
]

// helper
function isAllowed(origin: string): boolean {
  for (const rule of ALLOWLIST) {
    if (typeof rule === 'string' && rule === origin) return true
    if (rule instanceof RegExp && rule.test(origin)) return true
  }
  return false
}

async function bootstrap(): Promise<Handler> {
  const expressApp = express()
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { bufferLogs: true, logger: false },
  )

  // one CORS config
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)          // curl or Postman
      if (ALLOWLIST.length === 0) return cb(null, true) // reflect any origin
      return cb(null, isAllowed(origin))
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client-ID'],
    exposedHeaders: ['Content-Length', 'Content-Range'],
    credentials: false, // set true only if you actually use cookies
    maxAge: 86400,
  })

  // optional: make sure OPTIONS always gets a fast 204
  expressApp.options('*', (_req, res) => {
    res.status(204).end()
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  app.useGlobalFilters(
    new PrismaExceptionFilter(),
    new AllExceptionsFilter(),
  )

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

  try {
    console.error(JSON.stringify({ level: 'info', ts: new Date().toISOString(), msg: 'Lambda cold start ready' }))
  } catch {}

  return serverlessExpress({ app: expressApp })
}

export const handler: Handler = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false

  if (!cached) {
    process.on('unhandledRejection', (reason, p) => {
      try {
        console.error(JSON.stringify({ level: 'error', ts: new Date().toISOString(), type: 'unhandledRejection', reason, promise: String(p) }))
      } catch { console.error('unhandledRejection') }
    })
    process.on('uncaughtException', (err: any) => {
      try {
        console.error(JSON.stringify({ level: 'error', ts: new Date().toISOString(), type: 'uncaughtException', message: err?.message, stack: err?.stack }))
      } catch { console.error('uncaughtException') }
    })
    cached = await bootstrap()
  }

  return cached(event, context, callback)
}
