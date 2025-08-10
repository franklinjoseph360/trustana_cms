import { Handler } from 'aws-lambda'
import serverlessExpress from '@vendia/serverless-express'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ExpressAdapter } from '@nestjs/platform-express'
import express from 'express'

let cached: Handler | null = null

async function bootstrap(): Promise<Handler> {
  const expressApp = express()
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    bufferLogs: true,
  })
  app.enableCors()
  await app.init()
  return serverlessExpress({ app: expressApp })
}

export const handler: Handler = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false
  if (!cached) cached = await bootstrap()
  return cached(event, context, callback)
}
