import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { PROYECTO_DEMO_ID, type ProblemDetails } from './proyectos';

export interface TecnicoProyecto {
  id: string;
  nombre: string;
  email: string;
  /** ISO 8601 (timestamptz). */
  fechaAsignacion: string;
}

interface TecnicoCatalogo {
  id: string;
  nombre: string;
  email: string;
}

/** IDs de database/02_seed_dev.sql (+ un segundo técnico de simulación). */
export const TECNICO_DEMO_ID = '22222222-2222-4222-8222-222222222222';
export const TECNICO_CAMPO_ID = '22222222-2222-4222-8222-222222222225';

const TECNICOS: readonly TecnicoCatalogo[] = [
  { id: TECNICO_DEMO_ID, nombre: 'Técnico Demo', email: 'tecnico@serfamilia.test' },
  { id: TECNICO_CAMPO_ID, nombre: 'Ana Vargas', email: 'ana.vargas@serfamilia.test' },
];

const LATENCIA_MS = 450;

/** Asignaciones activas por proyecto (simula `proyecto_equipo` con `retirado_at IS NULL`). */
const equipoPorProyecto = new Map<string, TecnicoProyecto[]>([
  [
    PROYECTO_DEMO_ID,
    [
      {
        id: TECNICO_DEMO_ID,
        nombre: 'Técnico Demo',
        email: 'tecnico@serfamilia.test',
        fechaAsignacion: '2026-01-15T10:00:00.000Z',
      },
    ],
  ],
]);

function conLatencia<T>(valor: T | (() => T)): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(typeof valor === 'function' ? (valor as () => T)() : valor);
      } catch (e) {
        reject(e);
      }
    }, LATENCIA_MS);
  });
}

function errorHttp(
  method: 'get' | 'post' | 'delete',
  url: string,
  status: number,
  title: string,
  detail: string,
): AxiosError<ProblemDetails> {
  const config = { url, method, headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError<ProblemDetails>(detail, AxiosError.ERR_BAD_REQUEST, config, undefined, {
    status,
    statusText: title,
    headers: {},
    config,
    data: { type: 'about:blank', title, status, detail, instance: `/api${url}` },
  });
}

function equipoDe(proyectoId: string): TecnicoProyecto[] {
  if (!equipoPorProyecto.has(proyectoId)) equipoPorProyecto.set(proyectoId, []);
  return equipoPorProyecto.get(proyectoId)!;
}

export async function obtenerEquipo(proyectoId: string): Promise<TecnicoProyecto[]> {
  return conLatencia(() => equipoDe(proyectoId).map((t) => ({ ...t })));
}

/** Técnicos del catálogo que aún no están asignados al proyecto (filtro por nombre). */
export async function buscarTecnicosDisponibles(
  proyectoId: string,
  consulta: string,
): Promise<TecnicoCatalogo[]> {
  return conLatencia(() => {
    const asignados = new Set(equipoDe(proyectoId).map((t) => t.id));
    const q = consulta.trim().toLowerCase();
    return TECNICOS.filter(
      (t) => !asignados.has(t.id) && (!q || t.nombre.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)),
    ).map((t) => ({ ...t }));
  });
}

export async function asignarTecnico(proyectoId: string, usuarioId: string): Promise<TecnicoProyecto> {
  return conLatencia(() => {
    const url = `/proyectos/${proyectoId}/equipo`;
    const catalogo = TECNICOS.find((t) => t.id === usuarioId);
    if (!catalogo) throw errorHttp('post', url, 404, 'Not Found', 'El técnico no existe.');

    const equipo = equipoDe(proyectoId);
    if (equipo.some((t) => t.id === usuarioId)) {
      throw errorHttp('post', url, 409, 'Conflict', 'El técnico ya está asignado al proyecto.');
    }

    const asignado: TecnicoProyecto = {
      id: catalogo.id,
      nombre: catalogo.nombre,
      email: catalogo.email,
      fechaAsignacion: new Date().toISOString(),
    };
    equipo.push(asignado);
    return { ...asignado };
  });
}

export async function retirarTecnico(proyectoId: string, usuarioId: string): Promise<void> {
  return conLatencia(() => {
    const url = `/proyectos/${proyectoId}/equipo/${usuarioId}`;
    const equipo = equipoDe(proyectoId);
    const idx = equipo.findIndex((t) => t.id === usuarioId);
    if (idx < 0) throw errorHttp('delete', url, 404, 'Not Found', 'El técnico no está asignado al proyecto.');
    equipo.splice(idx, 1);
  });
}
