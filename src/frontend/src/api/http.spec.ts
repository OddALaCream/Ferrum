import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { conectarSesion, http } from './http';

/** Adaptador falso: responde según la URL y el token que llega en el header. */
function adaptador(respuestas: (config: InternalAxiosRequestConfig) => { status: number; data?: unknown }) {
  return async (config: InternalAxiosRequestConfig) => {
    const r = respuestas(config);
    const respuesta = { data: r.data ?? {}, status: r.status, statusText: '', headers: {}, config };
    if (r.status >= 400) throw new AxiosError('error', String(r.status), config, null, respuesta);
    return respuesta;
  };
}

const autorizacion = (c: InternalAxiosRequestConfig) => AxiosHeaders.from(c.headers).get('Authorization');

describe('cliente http con sesión', () => {
  afterEach(() => conectarSesion(null));

  it('agrega el access token en cada petición', async () => {
    conectarSesion({ token: () => 'abc', renovar: vi.fn(), alExpirar: vi.fn() });
    let recibido: unknown;
    await http.get('/proyectos', {
      adapter: adaptador((c) => {
        recibido = autorizacion(c);
        return { status: 200 };
      }),
    });
    expect(recibido).toBe('Bearer abc');
  });

  it('ante un 401 renueva el token una vez y repite la petición', async () => {
    const renovar = vi.fn().mockResolvedValue('nuevo');
    conectarSesion({ token: () => 'viejo', renovar, alExpirar: vi.fn() });

    const res = await http.get('/proyectos', {
      adapter: adaptador((c) => (autorizacion(c) === 'Bearer nuevo' ? { status: 200, data: 'ok' } : { status: 401 })),
    });

    expect(renovar).toHaveBeenCalledTimes(1);
    expect(res.data).toBe('ok');
  });

  it('si no se puede renovar, avisa que la sesión expiró', async () => {
    const alExpirar = vi.fn();
    conectarSesion({ token: () => 'viejo', renovar: vi.fn().mockResolvedValue(null), alExpirar });

    await expect(http.get('/proyectos', { adapter: adaptador(() => ({ status: 401 })) })).rejects.toBeInstanceOf(AxiosError);
    expect(alExpirar).toHaveBeenCalled();
  });

  it('no intenta renovar cuando falla una ruta de /auth', async () => {
    const renovar = vi.fn();
    conectarSesion({ token: () => null, renovar, alExpirar: vi.fn() });

    await expect(http.post('/auth/login', {}, { adapter: adaptador(() => ({ status: 401 })) })).rejects.toBeInstanceOf(AxiosError);
    expect(renovar).not.toHaveBeenCalled();
  });
});