import { http } from './http';

/** Actividad vencida y sin completar. */
export interface ActividadRetrasada {
  id: string;
  codigo: string;
  nombre: string;
  resultadoCodigo: string;
  proyectoId: string;
  proyectoCodigo: string;
  proyectoNombre: string;
  responsable: string | null;
  fechaFin: string;
  diasAtraso: number;
  cumplimientoPct: number;
}

export interface ActividadPendiente {
  id: string;
  codigo: string;
  nombre: string;
  tipoCronograma: 'CONTINUO' | 'DISCRETO';
  estado: 'PENDIENTE' | 'EN_CURSO' | 'RETRASADA';
  retrasada: boolean;
  fechaInicio: string;
  fechaFin: string;
  cumplimientoPct: number;
  resultadoCodigo: string;
  proyectoId: string;
  proyectoCodigo: string;
  proyectoNombre: string;
  /** Actividades discretas: fecha de la próxima sesión por realizar. */
  proximaSesion: string | null;
  /** Sesiones cuya fecha ya pasó y nadie marcó como realizadas. */
  sesionesSinMarcar: number;
}

export interface TareaPendiente {
  id: string;
  nombre: string;
  estado: 'PENDIENTE' | 'EN_CURSO';
  fechaLimite: string | null;
  vencida: boolean;
  actividadId: string;
  actividadCodigo: string;
  proyectoId: string;
  proyectoCodigo: string;
}

/** Lo que le toca hacer a un técnico: sus actividades y sus tareas sin cerrar. */
export interface MiTrabajo {
  resumen: {
    actividadesActivas: number;
    actividadesRetrasadas: number;
    tareasPendientes: number;
    tareasVencidas: number;
    sesionesSinMarcar: number;
  };
  actividades: ActividadPendiente[];
  tareas: TareaPendiente[];
}

/** Administrador: todas; Supervisor: las de sus proyectos; Técnico: las suyas. */
export async function obtenerRetrasadas(): Promise<ActividadRetrasada[]> {
  const { data } = await http.get<ActividadRetrasada[]>('/seguimiento/retrasadas');
  return data;
}

/** Solo el Técnico. */
export async function obtenerMiTrabajo(): Promise<MiTrabajo> {
  const { data } = await http.get<MiTrabajo>('/seguimiento/mi-trabajo');
  return data;
}