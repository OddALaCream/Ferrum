import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

/** Enum `estado_proyecto` de PostgreSQL. */
export type EstadoProyecto = 'PLANIFICACION' | 'EN_EJECUCION' | 'PAUSADO' | 'CERRADO';

/** Enum `moneda_tipo` de PostgreSQL (RF-02). */
export const MONEDAS = ['BOB', 'USD', 'EUR'] as const;
export type Moneda = (typeof MONEDAS)[number];

export interface Financiador {
  id: string;
  nombre: string;
}

export interface CreateProyectoDto {
  codigo: string;
  nombre: string;
  financiadorId: string;
  /** Formato ISO `YYYY-MM-DD` (columna `date` en PostgreSQL). */
  fechaInicio: string;
  fechaFin: string;
}

export interface Proyecto extends CreateProyectoDto {
  id: string;
  descripcion: string | null;
  objetivoGeneral: string | null;
  /** NUMERIC(14,2) como texto ("850000.50") para no perder precisión. */
  presupuestoTotal: string;
  moneda: Moneda;
  estado: EstadoProyecto;
}

/** Cuerpo de PATCH /proyectos/:id/presupuesto (RF-02). */
export interface RegistrarPresupuestoDto {
  /** Monto con hasta dos decimales, como texto: "850000.50". */
  monto: string;
  moneda: Moneda;
}

/** Cuerpo de error que devuelve la API (RFC 7807, ver ProblemDetailsFilter). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string | string[];
  instance: string;
}

/** IDs de database/02_seed_dev.sql */
export const PROYECTO_DEMO_ID = '33333333-3333-4333-8333-333333333333';

export const FINANCIADORES_SIMULADOS: readonly Financiador[] = [
  { id: '11111111-1111-4111-8111-111111111111', nombre: 'Financiador Demo' },
  { id: '11111111-1111-4111-8111-111111111112', nombre: 'BID' },
  { id: '11111111-1111-4111-8111-111111111113', nombre: 'Ayuntamiento de Madrid' },
];

// ---------------------------------------------------------------------
// Simulación hasta que existan los endpoints del módulo proyectos (SGP-6, SGP-8).
// Para conectar la API real, reemplace el cuerpo de cada función por la llamada indicada:
//   getFinanciadores: http.get<Financiador[]>('/financiadores')
//   crearProyecto:    http.post<Proyecto>('/proyectos', dto)
//   obtenerProyecto:  http.get<Proyecto>(`/proyectos/${id}`)
//   actualizarEstado: http.patch<Proyecto>(`/proyectos/${id}/estado`, { estado })
//   registrarPresupuesto: http.patch<Proyecto>(`/proyectos/${id}/presupuesto`, dto)   (ya disponible, SGP-7)
// ---------------------------------------------------------------------

const LATENCIA_MS = 600;

const proyectos = new Map<string, Proyecto>([
  [
    PROYECTO_DEMO_ID,
    {
      id: PROYECTO_DEMO_ID,
      codigo: 'PRY-DEMO-001',
      nombre: 'Proyecto de demostración',
      descripcion: 'Proyecto de ejemplo para desarrollo y pruebas.',
      objetivoGeneral: 'Mejorar las condiciones familiares en la región',
      financiadorId: '11111111-1111-4111-8111-111111111111',
      presupuestoTotal: '100000.00',
      moneda: 'BOB',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      estado: 'EN_EJECUCION',
    },
  ],
]);

const esperar = () => new Promise((r) => setTimeout(r, LATENCIA_MS));

/**
 * Misma validación que el backend (RegistrarPresupuestoDto): devuelve el motivo
 * por el que el monto no es válido, o `null` si lo es. NUMERIC(14,2) → 12 enteros y 2 decimales.
 */
export function motivoMontoInvalido(monto: string | null | undefined): string | null {
  if (monto === null || monto === undefined || monto.trim() === '') return 'El monto del presupuesto es obligatorio.';
  if (monto.trim().startsWith('-')) return 'El monto del presupuesto no puede ser negativo.';
  if (!/^\d+(\.\d+)?$/.test(monto)) {
    return 'El monto del presupuesto debe ser un número con punto decimal (p. ej. 850000.50).';
  }
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(monto)) {
    return 'El monto del presupuesto admite como máximo 12 dígitos enteros y 2 decimales.';
  }
  return null;
}

function errorHttp(
  method: 'get' | 'post' | 'patch',
  url: string,
  status: number,
  title: string,
  detail: string,
): AxiosError<ProblemDetails> {
  const config = { url, method, headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const code = status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST;
  return new AxiosError<ProblemDetails>(detail, code, config, undefined, {
    status,
    statusText: title,
    headers: {},
    config,
    data: { type: 'about:blank', title, status, detail, instance: `/api${url}` },
  });
}

function buscar(method: 'get' | 'patch', url: string, id: string): Proyecto {
  const proyecto = proyectos.get(id);
  if (!proyecto) throw errorHttp(method, url, 404, 'Not Found', 'El proyecto no existe.');
  return proyecto;
}

export async function getFinanciadores(): Promise<Financiador[]> {
  return [...FINANCIADORES_SIMULADOS];
}

export async function crearProyecto(dto: CreateProyectoDto): Promise<Proyecto> {
  await esperar();
  const codigo = dto.codigo.trim();
  if ([...proyectos.values()].some((p) => p.codigo === codigo)) {
    throw errorHttp('post', '/proyectos', 409, 'Conflict', `Ya existe un proyecto con el código ${codigo}.`);
  }
  const proyecto: Proyecto = {
    ...dto,
    codigo,
    id: crypto.randomUUID(),
    descripcion: null,
    objetivoGeneral: null,
    presupuestoTotal: '0.00',
    moneda: 'BOB',
    estado: 'PLANIFICACION',
  };
  proyectos.set(proyecto.id, proyecto);
  return { ...proyecto };
}

export async function obtenerProyecto(id: string): Promise<Proyecto> {
  await esperar();
  return { ...buscar('get', `/proyectos/${id}`, id) };
}

/** RN-09: un proyecto CERRADO es terminal; cualquier transición desde él responde 422. */
export async function actualizarEstado(id: string, nuevoEstado: EstadoProyecto): Promise<Proyecto> {
  await esperar();
  const url = `/proyectos/${id}/estado`;
  const proyecto = buscar('patch', url, id);
  if (proyecto.estado === 'CERRADO' && nuevoEstado !== 'CERRADO') {
    throw errorHttp(
      'patch',
      url,
      422,
      'Unprocessable Entity',
      'Un proyecto cerrado no puede cambiar de estado (RN-09).',
    );
  }
  proyecto.estado = nuevoEstado;
  return { ...proyecto };
}

/** RF-02 / CP-02: registra el presupuesto total aprobado con su moneda. */
export async function registrarPresupuesto(id: string, dto: RegistrarPresupuestoDto): Promise<Proyecto> {
  await esperar();
  const url = `/proyectos/${id}/presupuesto`;
  const proyecto = buscar('patch', url, id);
  const motivo = motivoMontoInvalido(dto.monto);
  if (motivo) throw errorHttp('patch', url, 400, 'Bad Request', motivo);
  if (!MONEDAS.includes(dto.moneda)) {
    throw errorHttp('patch', url, 400, 'Bad Request', `La moneda debe ser una de: ${MONEDAS.join(', ')}.`);
  }
  if (proyecto.estado === 'CERRADO') {
    throw errorHttp(
      'patch',
      url,
      422,
      'Unprocessable Entity',
      'No se puede modificar el presupuesto de un proyecto cerrado (RN-09).',
    );
  }
  const [enteros, decimales = ''] = dto.monto.split('.');
  proyecto.presupuestoTotal = `${BigInt(enteros)}.${decimales.padEnd(2, '0')}`;
  proyecto.moneda = dto.moneda;
  return { ...proyecto };
}
