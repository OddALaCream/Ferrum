import type { Actividad, EstadoActividad } from '../entities/actividad.entity';
import type { ActividadSesion } from '../entities/actividad-sesion.entity';
import type { Iov } from '../entities/iov.entity';
import type { Resultado } from '../entities/resultado.entity';
import type { Tarea } from '../entities/tarea.entity';

/** Actividad con su estado real: una actividad vencida y no completada se ve como RETRASADA. */
export interface ActividadVista extends Omit<Actividad, 'resultado' | 'sesiones' | 'tareas'> {
  estadoEfectivo: EstadoActividad;
  sesiones: Omit<ActividadSesion, 'actividad'>[];
  tareas: Omit<Tarea, 'actividad'>[];
}

export interface ResultadoVista extends Omit<Resultado, 'indicadores' | 'actividades'> {
  indicadores: Omit<Iov, 'resultado'>[];
  actividades: ActividadVista[];
}

export interface ArbolMarcoLogico {
  proyecto: { id: string; codigo: string; nombre: string; estado: string; fechaInicio: string; fechaFin: string };
  resultados: ResultadoVista[];
}