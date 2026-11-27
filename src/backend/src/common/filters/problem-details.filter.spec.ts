import { BadRequestException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ProblemDetailsFilter } from './problem-details.filter';

function respuesta() {
  const res = { status: jest.fn(), type: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.type.mockReturnValue(res);
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ originalUrl: '/api/x' }) }),
  } as unknown as ArgumentsHost;
  return { res, host };
}

const errorPg = (driver: Record<string, unknown>) =>
  new QueryFailedError('DELETE FROM evidencias', [], Object.assign(new Error(String(driver.message)), driver));

describe('ProblemDetailsFilter', () => {
  const filtro = new ProblemDetailsFilter();

  it('una regla de negocio de un trigger (23514 sin constraint) responde 422 con su mensaje', () => {
    const { res, host } = respuesta();
    filtro.catch(errorPg({ code: '23514', message: 'Las evidencias de un avance enviado no se pueden borrar' }), host);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 422, detail: 'Las evidencias de un avance enviado no se pueden borrar.' }));
  });

  it('un CHECK de columna (23514 con constraint) sigue siendo un error interno sin detalles', () => {
    const { res, host } = respuesta();
    jest.spyOn((filtro as unknown as { logger: { error: () => void } }).logger, 'error').mockImplementation(() => undefined);
    filtro.catch(errorPg({ code: '23514', constraint: 'ck_x', message: 'new row violates check constraint "ck_x"' }), host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Error interno del servidor' }));
  });

  it('otros errores de la base siguen siendo 500', () => {
    const { res, host } = respuesta();
    jest.spyOn((filtro as unknown as { logger: { error: () => void } }).logger, 'error').mockImplementation(() => undefined);
    filtro.catch(errorPg({ code: '23505', message: 'duplicate key' }), host);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('las excepciones HTTP mantienen su estado y mensaje', () => {
    const { res, host } = respuesta();
    filtro.catch(new BadRequestException('Falta el nombre'), host);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Falta el nombre' }));
  });
});