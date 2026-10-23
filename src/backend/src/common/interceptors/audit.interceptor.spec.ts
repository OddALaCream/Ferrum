import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { lastValueFrom, Observable } from 'rxjs';
import { ContextoAuditoria } from '../../modules/auditoria/contexto-auditoria';
import { AuditInterceptor, datosDePeticion, normalizarIp } from './audit.interceptor';

const USUARIO = '22222222-2222-4222-8222-222222222221';

function peticion(metodo: string, extra: Partial<Request> & { user?: unknown } = {}): Request {
  return {
    method: metodo,
    ip: '::ffff:192.168.1.20',
    get: (h: string) => (h.toLowerCase() === 'user-agent' ? 'Mozilla/5.0' : undefined),
    ...extra,
  } as unknown as Request;
}

function contextoHttp(req: Request): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('AuditInterceptor', () => {
  const contexto = new ContextoAuditoria();
  const interceptor = new AuditInterceptor(contexto);

  /** El handler async lee el contexto como lo haría el AuditSubscriber al guardar. */
  const handler: CallHandler = {
    handle: () =>
      new Observable((s) => {
        setTimeout(() => {
          s.next(contexto.actual());
          s.complete();
        });
      }),
  };

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('en %s el handler ve usuario, IP y user-agent', async (metodo) => {
    const req = peticion(metodo, { user: { sub: USUARIO, email: 'director@serfamilia.test' } } as never);

    const datos = await lastValueFrom(interceptor.intercept(contextoHttp(req), handler));

    expect(datos).toEqual({
      usuarioId: USUARIO,
      usuarioEmail: 'director@serfamilia.test',
      ip: '192.168.1.20',
      userAgent: 'Mozilla/5.0',
    });
  });

  it('en GET no crea contexto de auditoría', async () => {
    const datos = await lastValueFrom(interceptor.intercept(contextoHttp(peticion('GET')), handler));
    expect(datos).toBeUndefined();
  });

  it('fuera de una petición no hay contexto', () => {
    expect(contexto.actual()).toBeUndefined();
  });
});

describe('datosDePeticion', () => {
  it('sin sesión deja el usuario en null', () => {
    expect(datosDePeticion(peticion('POST'))).toMatchObject({ usuarioId: null, usuarioEmail: null });
  });

  it('descarta un id de usuario que no es UUID', () => {
    expect(datosDePeticion(peticion('POST', { user: { id: '1 OR 1=1' } } as never)).usuarioId).toBeNull();
  });

  it('recorta el user-agent a 300 caracteres', () => {
    const req = peticion('POST', { get: () => 'x'.repeat(500) } as never);
    expect(datosDePeticion(req).userAgent).toHaveLength(300);
  });
});

describe('normalizarIp', () => {
  it.each([
    ['::ffff:127.0.0.1', '127.0.0.1'],
    ['10.0.0.5', '10.0.0.5'],
    ['2001:db8::1', '2001:db8::1'],
    ['no-es-ip', null],
    [undefined, null],
  ])('%p → %p', (entrada, esperado) => {
    expect(normalizarIp(entrada)).toBe(esperado);
  });
});
