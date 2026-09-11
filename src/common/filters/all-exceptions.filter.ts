import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const _request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: (exception as Error)?.message || 'Internal server error' };

    console.log('Exception response:', errorResponse);

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
