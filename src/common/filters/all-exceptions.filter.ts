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

    let message: string;
    let errors: Record<string, string[]> | undefined;

    if (typeof errorResponse === 'string') {
      message = errorResponse;
    } else {
      const errObj = errorResponse as any;
      // Handle class-validator errors (array of messages)
      if (Array.isArray(errObj.message)) {
        message = 'Validation failed';
        errors = {};
        for (const msg of errObj.message) {
          // Try to extract field name from message like "phone must be..."
          const field = msg.split(' ')[0] ?? 'general';
          if (!errors[field]) errors[field] = [];
          errors[field].push(msg);
        }
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
