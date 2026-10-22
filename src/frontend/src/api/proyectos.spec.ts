import { isAxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EstadoProyecto } from './proyectos';

type Api = typeof import('./proyectos');

/** El mock guarda estado en memoria: cada prueba usa una instancia limpia del módulo. */
let api: Api;

async function conLatencia<T>(promesa: Promise<T>): Promise<T> {
  const resultado = promesa.then(
    (v) => ({ ok: true as const, v }),
    (e: unknown) => ({ ok: false as const, e }),
  );
  await vi.runAllTimersAsync();
  const r = await resultado;
  if (!r.ok) throw r.e;
  return r.v;
}

async function estadoHttpDe(promesa: Promise<unknown>): Promise<number | undefined> {
  try {
    await conLatencia(promesa);
  } catch (e) {
    return isAxiosError(e) ? e.response?.status : undefined;
  }
  throw new Error('Se esperaba un error HTTP');
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  api = await import('./proyectos');
});

afterEach(() => vi.useRealTimers());

describe('obtenerProyecto', () => {
  it('devuelve PRY-DEMO-001 con los datos del seed', async () => {
    const p = await conLatencia(api.obtenerProyecto(api.PROYECTO_DEMO_ID));
    expect(p).toMatchObject({
      codigo: 'PRY-DEMO-001',
      estado: 'EN_EJECUCION',
      financiadorId: '11111111-1111-4111-8111-111111111111',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
    });
  });

  it('responde 404 si el proyecto no existe', async () => {
    expect(await estadoHttpDe(api.obtenerProyecto('00000000-0000-4000-8000-000000000000'))).toBe(404);
  });
});

describe('actualizarEstado', () => {
  it('permite cambiar de EN_EJECUCION a PAUSADO', async () => {
    const p = await conLatencia(api.actualizarEstado(api.PROYECTO_DEMO_ID, 'PAUSADO'));
    expect(p.estado).toBe('PAUSADO');
  });

  it.each<EstadoProyecto>(['EN_EJECUCION', 'PLANIFICACION', 'PAUSADO'])(
    'CP-03: rechaza con 422 la transición de CERRADO a %s y conserva el estado',
    async (destino) => {
      await conLatencia(api.actualizarEstado(api.PROYECTO_DEMO_ID, 'CERRADO'));

      expect(await estadoHttpDe(api.actualizarEstado(api.PROYECTO_DEMO_ID, destino))).toBe(422);
      const p = await conLatencia(api.obtenerProyecto(api.PROYECTO_DEMO_ID));
      expect(p.estado).toBe('CERRADO');
    },
  );

  it('CP-03: el 422 trae el detalle en formato Problem Details', async () => {
    await conLatencia(api.actualizarEstado(api.PROYECTO_DEMO_ID, 'CERRADO'));
    try {
      await conLatencia(api.actualizarEstado(api.PROYECTO_DEMO_ID, 'EN_EJECUCION'));
    } catch (e) {
      expect(isAxiosError(e) && e.response?.data).toMatchObject({ status: 422, detail: expect.stringContaining('RN-09') });
      return;
    }
    throw new Error('Se esperaba un 422');
  });
});
