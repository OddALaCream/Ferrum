import { http } from './http';

/** Enum `estado_proyecto` de PostgreSQL. */
export type EstadoProyecto = 'PLANIFICACION' | 'EN_EJECUCION' | 'PAUSADO' | 'CERRADO';

/** Enum `moneda_tipo` de PostgreSQL (RF-02 / SGP-7). */
export const MONEDAS = ['BOB', 'USD', 'EUR'] as const;
export type Moneda = (typeof MONEDAS)[number];

export interface CreateProyectoDto {
  codigo: string;
  nombre: string;
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

/**
 * Validación de monto en el cliente (misma regla que el backend).
 * NUMERIC(14,2) → 12 enteros y 2 decimales.
 */
export function motivoMontoInvalido(monto: string | null | undefined): string | null {
  if (monto === null || monto === undefined || monto.trim() === '') {
    return 'El monto del presupuesto es obligatorio.';
  }
  if (monto.trim().startsWith('-')) return 'El monto del presupuesto no puede ser negativo.';
  if (!/^\d+(\.\d+)?$/.test(monto)) {
    return 'El monto del presupuesto debe ser un número con punto decimal (p. ej. 850000.50).';
  }
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(monto)) {
    return 'El monto del presupuesto admite como máximo 12 dígitos enteros y 2 decimales.';
  }
  return null;
}

export async function crearProyecto(dto: CreateProyectoDto): Promise<Proyecto> {
  const { data } = await http.post<Proyecto>('/proyectos', dto);
  return data;
}

export async function obtenerProyecto(id: string): Promise<Proyecto> {
  const { data } = await http.get<Proyecto>(`/proyectos/${id}`);
  return data;
}

export async function actualizarEstado(id: string, nuevoEstado: EstadoProyecto): Promise<Proyecto> {
  const { data } = await http.patch<Proyecto>(`/proyectos/${id}/estado`, { estado: nuevoEstado });
  return data;
}

/** RF-02 / CP-02 / SGP-7: registra el presupuesto total aprobado con su moneda. */
export async function registrarPresupuesto(id: string, dto: RegistrarPresupuestoDto): Promise<Proyecto> {
  const { data } = await http.patch<Proyecto>(`/proyectos/${id}/presupuesto`, dto);
  return data;
}