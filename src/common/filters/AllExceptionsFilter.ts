import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const nowIso = new Date().toISOString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let clientMessage = 'Internal server error';
    let errorResponse: any = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      errorResponse = typeof res === 'string' ? { message: res } : res;
      clientMessage =
        Array.isArray(errorResponse?.message)
          ? errorResponse.message.join(', ')
          : errorResponse?.message || clientMessage;
    } else if (exception instanceof Error) {
      clientMessage = exception.message || clientMessage;
      errorResponse = { message: clientMessage };
    } else {
      errorResponse = { message: clientMessage };
    }

    // Prefer request IDs that exist in API Gateway / ALB / custom proxies
    const headerValue = (v: string | string[] | undefined) =>
      Array.isArray(v) ? v[0] : v;

    const requestId =
      headerValue(request.headers['x-request-id']) ||
      headerValue(request.headers['x-amzn-trace-id']) ||
      headerValue(request.headers['x-amzn-requestid']) ||
      headerValue(request.headers['x-correlation-id']) ||
      undefined;

    const ip =
      headerValue(request.headers['x-forwarded-for']) ||
      request.ip ||
      request.socket?.remoteAddress ||
      undefined;

    // Build a single JSON log line for CloudWatch
    const logPayload = {
      level: 'error',
      ts: nowIso,
      requestId,
      method: request.method,
      path: request.url,
      ip,
      userAgent: headerValue(request.headers['user-agent']),
      statusCode: status,
      // Keep a concise message for searching
      message: clientMessage,
      // Useful details for debugging in CloudWatch Logs
      details: {
        // Only include selected inputs to avoid leaking PII
        query: request.query,
        params: request.params,
      },
      // Raw exception info for engineers (safe to log, not returned to client)
      error:
        exception instanceof Error
          ? {
              name: exception.name,
              message: exception.message,
              stack: exception.stack,
              // Some libraries like Prisma attach a `code` field
              ...(exception as any).code ? { code: (exception as any).code } : {},
            }
          : { value: String(exception) },
    };

    // Write to stderr so it always appears in CloudWatch Live Tail
    try {
      console.error(JSON.stringify(logPayload));
    } catch {
      // Fallback if circular structures sneak in
      console.error(
        JSON.stringify({
          level: 'error',
          ts: nowIso,
          message: 'Failed to stringify error payload',
        }),
      );
    }

    // Send a safe response to the client
    response.status(status).json({
      statusCode: status,
      message: clientMessage,
      path: request.url,
      timestamp: nowIso,
      // Optionally echo requestId back so clients can report it
      ...(requestId ? { requestId } : {}),
    });
  }
}
