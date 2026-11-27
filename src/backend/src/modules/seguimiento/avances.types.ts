import type { EstadoAvance } from './entities/avance.entity';

export interface EvidenciaVista {
  id: string;
  version: number;
  nombreOriginal: string;
  mime: string;
  tamanoBytes: number;
  sha256: string;
  subidoPorId: string;
  createdAt: string;
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