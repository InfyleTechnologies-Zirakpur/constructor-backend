import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: (exception as Error)?.message || 'Internal server error' };

    // Log 5xx errors as errors; 4xx as warnings; never in test
    if (process.env.NODE_ENV !== 'test') {
      if (status >= 500) {
        this.logger.error(
          `${request.method} ${request.url} → ${status}`,
          exception instanceof Error ? exception.stack : String(exception),
        );
      } else if (status >= 400) {
        this.logger.warn(`${request.method} ${request.url} → ${status}`);
      }
    }

    let message: string;
    let errors: Record<string, string[]> | undefined;

    if (typeof errorResponse === 'string') {
      message = errorResponse;
    } else {
      const errObj = errorResponse as any;
      if (errObj.errors) {
        message = errObj.message || 'Validation failed';
        errors = errObj.errors;
      } else if (Array.isArray(errObj.message)) {
        message = errObj.message[0] || 'An error occurred';
      } else {
        message = errObj.message || 'An error occurred';
      }
    }

    response.status(status).json({
      success: false,
      message,
      ...(errors ? { errors } : {}),
    });
  }
}
