import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception?.response?.message || exception?.message || 'Internal server error';

    response.status(status).json({
      ok: false,
      error: {
        message,
        status,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
