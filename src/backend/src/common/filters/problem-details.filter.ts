import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

/**
 * Una regla de negocio que la base hace cumplir con un trigger (RAISE ... ERRCODE 23514) llega como
 * QueryFailedError. Si el servicio no la atajó antes (p. ej. dos pestañas a la vez), se responde 422 con
 * el mensaje del trigger, en vez de un 500. Un CHECK de columna también usa 23514, pero trae `constraint`
 * y su mensaje es técnico: ese sigue siendo un error interno.
 */
function reglaDeNegocio(exception: unknown): string | null {
  if (!(exception instanceof QueryFailedError)) return null;
  const pg = exception.driverError as { code?: string; constraint?: string; message?: string } | undefined;
  if (pg?.code !== '23514' || pg.constraint) return null;
  return pg.message ?? null;
}

/** GlobalExceptionFilter: normaliza los errores según RFC 7807 (Problem Details). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const regla = reglaDeNegocio(exception);
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : regla
          ? HttpStatus.UNPROCESSABLE_ENTITY
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : regla ? `${regla}.` : null;
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