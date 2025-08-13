import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    // Prisma known request errors become 4xx
    if (exception?.code && typeof exception.code === 'string') {
      const code = exception.code as string;
      const map: Record<string, number> = {
        P2002: HttpStatus.CONFLICT,        // unique constraint
        P2003: HttpStatus.BAD_REQUEST,     // FK constraint
        P2025: HttpStatus.NOT_FOUND,       // record not found
      };
      const status = map[code] ?? HttpStatus.BAD_REQUEST;
      return res.status(status).json({ error: code, message: exception.message });
    }

    // Known HttpExceptions pass through
    if (exception instanceof HttpException) {
      return res.status(exception.getStatus()).json(exception.getResponse());
    }

    // Fallback 500 with safe message
    console.error('[Unhandled]', exception);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'InternalServerError' });
  }
}
