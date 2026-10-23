import type { RegistroAuditoria, Valores } from '@/api/auditoria';

/** Hora oficial del sistema (SRS): las fechas de la bitácora se muestran en America/La_Paz. */
export const ZONA_HORARIA = 'America/La_Paz';

export const ACCIONES: Record<string, { label: string; clases: string; icono: string }> = {
  CREAR: { label: 'Creación', clases: '!bg-emerald-50 !text-emerald-700', icono: 'pi pi-plus' },
  ACTUALIZAR: { label: 'Modificación', clases: '!bg-sky-50 !text-sky-700', icono: 'pi pi-pencil' },
  ELIMINAR: { label: 'Eliminación', clases: '!bg-red-50 !text-red-700', icono: 'pi pi-trash' },
};

const ENTIDADES: Record<string, string> = {
  proyectos: 'Proyecto',
  proyecto_equipo: 'Equipo del proyecto',
  financiadores: 'Financiador',
  usuarios: 'Usuario',
  objetivos_especificos: 'Objetivo específico',
  resultados: 'Resultado',
  iov: 'I.O.V.',
  actividades: 'Actividad',
  tareas: 'Tarea',
  avances: 'Avance',
  evidencias: 'Evidencia',
  partidas: 'Partida',
  gastos: 'Gasto',
  documentos_soporte: 'Documento de soporte',
  tramos: 'Tramo',
  tramo_condiciones: 'Condición de tramo',
  solicitudes_desembolso: 'Solicitud de desembolso',
  desembolsos: 'Desembolso',
};

/** Nombre legible de una tabla; si no se conoce, la tabla tal cual. */
export function etiquetaEntidad(entidad: string): string {
  return ENTIDADES[entidad] ?? entidad;
}

export function etiquetaAccion(accion: string) {
  return ACCIONES[accion] ?? { label: accion, clases: '!bg-slate-100 !text-slate-700', icono: 'pi pi-circle' };
}

/** Fecha y hora con segundos en la zona del sistema: "23/10/2026, 00:17:16". */
export function formatoFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-BO', {
    timeZone: ZONA_HORARIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Fecha local a `YYYY-MM-DD` sin pasar por UTC (toISOString podría restar un día). */
export function aFechaIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function quienRealizo(r: RegistroAuditoria): string {
  return r.usuarioNombre ?? r.usuarioEmail ?? 'Sin sesión';
}

/** Valor de un campo para mostrarlo en la tabla de cambios. */
export function formatoValor(valor: unknown): string {
  if (valor === undefined) return '';
  if (valor === null) return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

export interface CampoCambiado {
  campo: string;
  anterior: unknown;
  nuevo: unknown;
  cambio: boolean;
}

/** Une los campos de ambos valores para mostrarlos lado a lado; marca los que cambiaron. */
export function camposCambiados(anterior: Valores | null, nuevo: Valores | null): CampoCambiado[] {
  const campos = [...new Set([...Object.keys(anterior ?? {}), ...Object.keys(nuevo ?? {})])].sort();
  return campos.map((campo) => {
    const a = anterior ? anterior[campo] : undefined;
    const n = nuevo ? nuevo[campo] : undefined;
    return { campo, anterior: a, nuevo: n, cambio: JSON.stringify(a) !== JSON.stringify(n) };
  });
}
