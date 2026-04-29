// import {
//   ExceptionFilter,
//   Catch,
//   ArgumentsHost,
//   HttpException,
//   HttpStatus,
// } from '@nestjs/common';
// import { Request, Response } from 'express';

// @Catch()
// export class CustomExceptionFilter implements ExceptionFilter {
//   catch(exception: unknown, host: ArgumentsHost) {
//     const ctx = host.switchToHttp();
//     const response = ctx.getResponse<Response>();
//     const request = ctx.getRequest<Request>();

//     let status = HttpStatus.INTERNAL_SERVER_ERROR;
//     let message: any = 'Internal server error';

//     if (exception instanceof HttpException) {
//       status = exception.getStatus();
//       const res = exception.getResponse();

//       message = typeof res === 'string' ? res : (res as any).message || res;
//     } else {
//       if (process.env.NODE_ENV === 'development') {
//         message =
//           (exception as any)?.message ||
//           JSON.stringify(exception, Object.getOwnPropertyNames(exception));
//       } else {
//         message = 'Something went wrong, please try again later';
//       }
//     }

//     if (process.env.NODE_ENV === 'development') {
//       console.error(
//         `- ${(new Date().toLocaleDateString(), new Date().toLocaleTimeString())} [🔥 Error caught by CustomExceptionFilter]:`,
//         '\n \n------------------- This log is shown only in development environment -------------------\n',
//         exception,
//         '\n-------------------------------------------------------------------------------------------',
//       );
//     }

//     response.status(status).json({
//       success: false,
//       statusCode: status,
//       message,
//       path: request.url,
//       timestamp: new Date().toISOString(),
//     });
//   }
// }


import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class CustomExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res: any = exception.getResponse();

      message =
        typeof res === 'string'
          ? res
          : Array.isArray(res.message)
          ? res.message[0]
          : res.message || 'Unexpected error';
    } else {
      message =
        process.env.NODE_ENV === 'development'
          ? (exception as any)?.message || 'Unknown error'
          : 'Something went wrong, please try again later';
    }

    // Short development log only
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[DEV] Error:`, message);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
