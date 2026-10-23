import { http } from './http';

/** Valores de `audit_log.accion` (RF-34). */
export type AccionAuditoria = 'CREAR' | 'ACTUALIZAR' | 'ELIMINAR';

export type Valores = Record<string, unknown>;

export interface RegistroAuditoria {
  id: string;
  /** ISO 8601 (timestamptz). */
  fecha: string;
  usuarioId: string | null;
  usuarioEmail: string | null;
  usuarioNombre: string | null;
  accion: AccionAuditoria | string;
  /** Tabla afectada, p. ej. `proyectos`. */
  entidad: string;
  entidadId: string | null;
  proyectoId: string | null;
  proyectoCodigo: string | null;
  valorAnterior: Valores | null;
  valorNuevo: Valores | null;
  ip: string | null;
  userAgent: string | null;
}

export interface FiltrosBitacora {
  usuarioId?: string;
  entidad?: string;
  proyectoId?: string;
  /** `YYYY-MM-DD`, día completo en America/La_Paz. */
  desde?: string;
  hasta?: string;
  pagina?: number;
  limite?: number;
}

export interface PaginaBitacora {
  items: RegistroAuditoria[];
  total: number;
  pagina: number;
  limite: number;
}

export interface OpcionesBitacora {
  usuarios: { id: string; nombre: string; email: string }[];
  entidades: string[];
  proyectos: { id: string; codigo: string; nombre: string }[];
}

export async function consultarBitacora(filtros: FiltrosBitacora): Promise<PaginaBitacora> {
  const { data } = await http.get<PaginaBitacora>('/auditoria', { params: filtros });
  return data;
}

export async function obtenerOpcionesBitacora(): Promise<OpcionesBitacora> {
  const { data } = await http.get<OpcionesBitacora>('/auditoria/opciones');
  return data;
}
