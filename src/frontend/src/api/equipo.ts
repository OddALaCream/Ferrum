import { http } from './http';

export interface TecnicoProyecto {
  id: string;
  nombre: string;
  email: string;
  /** ISO 8601 (timestamptz). */
  fechaAsignacion: string;
}

export interface TecnicoDisponible {
  id: string;
  nombre: string;
  email: string;
}

export async function obtenerEquipo(proyectoId: string): Promise<TecnicoProyecto[]> {
  const { data } = await http.get<TecnicoProyecto[]>(`/proyectos/${proyectoId}/equipo`);
  return data;
}

export async function buscarTecnicosDisponibles(
  proyectoId: string,
  consulta: string,
): Promise<TecnicoDisponible[]> {
  const { data } = await http.get<TecnicoDisponible[]>(`/proyectos/${proyectoId}/equipo/disponibles`, {
    params: { q: consulta },
  });
  return data;
}

export async function asignarTecnico(proyectoId: string, usuarioId: string): Promise<TecnicoProyecto> {
  const { data } = await http.post<TecnicoProyecto>(`/proyectos/${proyectoId}/equipo`, { usuarioId });
  return data;
}

export async function retirarTecnico(proyectoId: string, usuarioId: string): Promise<void> {
  await http.delete(`/proyectos/${proyectoId}/equipo/${usuarioId}`);
}
