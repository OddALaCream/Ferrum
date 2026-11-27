import type { EstadoAvance } from './entities/avance.entity';
import type { EventoHistorial } from './utils/historial';

export interface EvidenciaVista {
  id: string;
  /** SGP-136: número de versión y la evidencia que corrige (null en la primera). */
  version: number;
  reemplazaA: string | null;
  /** false si ya hay una versión más nueva: queda en el historial. */
  vigente: boolean;
  nombreOriginal: string;
  mime: string;
  tamanoBytes: number;
  sha256: string;
  subidoPorId: string;
  createdAt: string;
  /** SGP-135: si el Administrador la anuló, cuándo, quién y por qué. El archivo se sigue pudiendo abrir. */
  anulacion: { at: string; por: { id: string; nombre: string }; motivo: string } | null;
}

/** Un avance con lo que lo identifica (indicador o actividad) y sus evidencias. */
export interface AvanceVista {
  id: string;
  /** Proyecto al que pertenece (lo usa la bandeja de revisión, que junta varios proyectos). */
  proyecto: { id: string; codigo: string; nombre: string };
  /** A qué aporta: un indicador (I.O.V.) o una actividad. */
  objetivo: { tipo: 'IOV' | 'ACTIVIDAD'; id: string; codigo: string; nombre: string; unidad: string | null };
  autor: { id: string; nombre: string };
  valorReportado: number | null;
  fechaCorte: string;
  descripcion: string | null;
  estado: EstadoAvance;
  enviadoAt: string | null;
  observacion: string | null;
  /** Quién lo aprobó u observó, y cuándo. */
  revisadoPor: { id: string; nombre: string } | null;
  revisadoAt: string | null;
  createdAt: string;
  updatedAt: string;
  evidencias: EvidenciaVista[];
}

/** SGP-116: el indicador o la actividad cuyo historial se consulta, con su avance acumulado. */
export interface ObjetivoHistorial {
  tipo: 'IOV' | 'ACTIVIDAD';
  id: string;
  codigo: string;
  nombre: string;
  unidad: string | null;
  meta: number | null;
  cumplimientoPct: number;
}

/** SGP-116 (CP-28): los avances de un indicador o actividad en orden cronológico, cada uno con su línea de tiempo. */
export interface HistorialVista {
  objetivo: ObjetivoHistorial;
  avances: Array<AvanceVista & { eventos: EventoHistorial[] }>;
}