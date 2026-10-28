import type { EstadoProyecto } from '../entities/proyecto.entity';
import type { Moneda } from '../presupuesto';

/** Una fila del listado de proyectos. */
export interface ProyectoResumen {
  id: string;
  codigo: string;
  nombre: string;
  estado: EstadoProyecto;
  /** NUMERIC(14,2) como texto, para no perder precisión. */
  presupuestoTotal: string;
  moneda: Moneda;
  fechaInicio: string;
  fechaFin: string;
  /** % de cumplimiento del proyecto (0 a 100). */
  cumplimientoPct: string;
  /** Técnicos con asignación vigente. */
  equipoActivo: number;
}

export interface ListaProyectos {
  items: ProyectoResumen[];
  total: number;
  page: number;
  limit: number;
}

/** Indicadores de la cartera visible para el usuario (el Técnico solo cuenta sus proyectos). */
export interface ResumenCartera {
  totalProyectos: number;
  porEstado: Record<EstadoProyecto, number>;
  /** Suma de presupuestos en bolivianos, como texto. */
  presupuestoBob: string;
  /** Técnicos distintos con asignación vigente en esos proyectos. */
  tecnicosActivos: number;
}