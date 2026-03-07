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

    const exceptionResponse = exception instanceof HttpException
      ? exception.getResponse()
      : null;

    let message: string = 'Internal server error';
    let code: string | undefined;
    let details: any;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const maybeMessage = (exceptionResponse as any).message;
      if (Array.isArray(maybeMessage)) {
        message = maybeMessage.join('; ');
      } else if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
        message = maybeMessage;
      }
      if ((exceptionResponse as any).code) code = String((exceptionResponse as any).code);
      if ((exceptionResponse as any).details !== undefined) details = (exceptionResponse as any).details;
    } else if (exception?.message) {
      message = String(exception.message);
    }

    response.status(status).json({
      ok: false,
      error: {
        code,
        message,
        details,
        status,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
