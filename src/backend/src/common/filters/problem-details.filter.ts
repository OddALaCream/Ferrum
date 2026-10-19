import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/** GlobalExceptionFilter: normaliza los errores según RFC 7807 (Problem Details). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;
    const detail =
      typeof body === 'string'
        ? body
        : (body as { message?: string | string[] } | null)?.message ?? 'Error interno del servidor';

    // Terminus responde 503 con el detalle de cada dependencia: se conserva tal cual.
    if (status === HttpStatus.SERVICE_UNAVAILABLE && typeof body === 'object' && body !== null && 'details' in body) {
      res.status(status).json(body);
      return;
    }

    if (status >= 500) this.logger.error(exception instanceof Error ? exception.stack : String(exception));

    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title: HttpStatus[status] ?? 'Error',
        status,
        detail: status >= 500 ? 'Error interno del servidor' : detail,
        instance: req.originalUrl,
      });
  }
}
