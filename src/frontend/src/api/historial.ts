import type { Avance } from './avances';
import { http } from './http';

/** SGP-116: qué pasó en la vida de un avance. */
export type TipoEvento =
  | 'REGISTRADO'
  | 'CORREGIDO'
  | 'ENVIADO'
  | 'REENVIADO'
  | 'OBSERVADO'
  | 'APROBADO'
  | 'ANULADO'
  | 'EVIDENCIA_ADJUNTADA'
  | 'EVIDENCIA_VERSION'
  | 'EVIDENCIA_ANULADA';

export interface EventoHistorial {
  tipo: TipoEvento;
  fecha: string;
  usuario: { id: string; nombre: string } | null;
  /** Observación, motivo de anulación, cambios corregidos o nombre de la evidencia. */
  detalle: string | null;
  evidenciaId: string | null;
}

export interface ObjetivoHistorial {
  tipo: 'IOV' | 'ACTIVIDAD';
  id: string;
  codigo: string;
  nombre: string;
  unidad: string | null;
  meta: number | null;
  cumplimientoPct: number;
}

export interface Historial {
  objetivo: ObjetivoHistorial;
  /** En orden cronológico (por fecha de corte), cada uno con su línea de tiempo. */
  avances: Array<Avance & { eventos: EventoHistorial[] }>;
}

/** CP-28: historial de un indicador o de una actividad. */
export async function obtenerHistorial(proyectoId: string, filtro: { iovId: string } | { actividadId: string }): Promise<Historial> {
  const { data } = await http.get<Historial>(`/proyectos/${proyectoId}/historial`, { params: filtro });
  return data;
}