import { http } from './http';

export type EstadoActividad = 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADA' | 'RETRASADA';
/** CONTINUO: corre de principio a fin. DISCRETO: ocurre en sesiones puntuales (talleres, reuniones…). */
export type TipoCronograma = 'CONTINUO' | 'DISCRETO';
export type EstadoTarea = 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADA';

export interface Tarea {
  id: string;
  actividadId: string;
  nombre: string;
  responsableId: string | null;
  estado: EstadoTarea;
  fechaLimite: string | null;
  cerradoAt: string | null;
}

export interface Sesion {
  id: string;
  actividadId: string;
  fecha: string;
  realizada: boolean;
  realizadaAt: string | null;
}

export interface Actividad {
  id: string;
  resultadoId: string;
  iovId: string | null;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  responsableId: string | null;
  fechaInicio: string;
  fechaFin: string;
  /** Estado guardado. */
  estado: EstadoActividad;
  /** Estado real: una actividad vencida y sin completar se ve RETRASADA. */
  estadoEfectivo: EstadoActividad;
  tipoCronograma: TipoCronograma;
  metaCuantitativa: number | null;
  unidadMeta: string | null;
  fuentesVerificacion: string | null;
  cumplimientoPct: number;
  sesiones: Sesion[];
  tareas: Tarea[];
}

export interface Indicador {
  id: string;
  resultadoId: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  lineaBase: number;
  meta: number;
  peso: number;
  fuenteVerificacion: string;
  valorActual: number;
  cumplimientoPct: number;
}

export interface Resultado {
  id: string;
  proyectoId: string;
  codigo: string;
  descripcion: string;
  peso: number;
  cumplimientoPct: number;
  indicadores: Indicador[];
  actividades: Actividad[];
}

export interface ArbolMarcoLogico {
  proyecto: { id: string; codigo: string; nombre: string; estado: string; fechaInicio: string; fechaFin: string };
  resultados: Resultado[];
}

export interface NuevoResultado {
  codigo: string;
  descripcion: string;
}

export interface NuevoIndicador {
  codigo: string;
  descripcion: string;
  unidad: string;
  lineaBase?: number;
  meta: number;
  peso?: number;
  fuenteVerificacion: string;
}

export interface NuevaActividad {
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipoCronograma: TipoCronograma;
  fechaInicio: string;
  fechaFin: string;
  responsableId?: string;
  metaCuantitativa?: number;
  unidadMeta?: string;
  fuentesVerificacion?: string;
  /** Solo actividades DISCRETAS: fechas YYYY-MM-DD. */
  sesiones?: string[];
}

const base = (proyectoId: string) => `/proyectos/${proyectoId}`;

export async function obtenerMarcoLogico(proyectoId: string): Promise<ArbolMarcoLogico> {
  const { data } = await http.get<ArbolMarcoLogico>(`${base(proyectoId)}/marco-logico`);
  return data;
}

export async function crearResultado(proyectoId: string, dto: NuevoResultado): Promise<Resultado> {
  const { data } = await http.post<Resultado>(`${base(proyectoId)}/resultados`, dto);
  return data;
}

export async function crearIndicador(proyectoId: string, resultadoId: string, dto: NuevoIndicador): Promise<Indicador> {
  const { data } = await http.post<Indicador>(`${base(proyectoId)}/resultados/${resultadoId}/indicadores`, dto);
  return data;
}

export async function crearActividad(proyectoId: string, resultadoId: string, dto: NuevaActividad): Promise<Actividad> {
  const { data } = await http.post<Actividad>(`${base(proyectoId)}/resultados/${resultadoId}/actividades`, dto);
  return data;
}

/** Actividad continua: el técnico responsable indica estado y avance (0–100). */
export async function cambiarEstadoActividad(
  proyectoId: string,
  actividadId: string,
  estado: 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADA',
  cumplimientoPct?: number,
): Promise<Actividad> {
  const { data } = await http.patch<Actividad>(`${base(proyectoId)}/actividades/${actividadId}/estado`, {
    estado,
    ...(cumplimientoPct === undefined ? {} : { cumplimientoPct }),
  });
  return data;
}

/** Actividad discreta: el técnico responsable marca si la sesión ya se realizó. */
export async function marcarSesion(
  proyectoId: string,
  actividadId: string,
  sesionId: string,
  realizada: boolean,
): Promise<Actividad> {
  const { data } = await http.patch<Actividad>(`${base(proyectoId)}/actividades/${actividadId}/sesiones/${sesionId}`, {
    realizada,
  });
  return data;
}

export async function crearTarea(
  proyectoId: string,
  actividadId: string,
  dto: { nombre: string; fechaLimite?: string; responsableId?: string },
): Promise<Tarea> {
  const { data } = await http.post<Tarea>(`${base(proyectoId)}/actividades/${actividadId}/tareas`, dto);
  return data;
}

export async function cambiarEstadoTarea(proyectoId: string, tareaId: string, estado: EstadoTarea): Promise<Tarea> {
  const { data } = await http.patch<Tarea>(`${base(proyectoId)}/tareas/${tareaId}`, { estado });
  return data;
}