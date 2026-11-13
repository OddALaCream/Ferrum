import { http } from './http';

export interface SupervisorProyecto {
  id: string;
  nombre: string;
  email: string;
  /** ISO 8601 (timestamptz). */
  fechaAsignacion: string;
}

export interface SupervisorDisponible {
  id: string;
  nombre: string;
  email: string;
}

/** Quién supervisa el proyecto. Lo ve quien tiene acceso al proyecto. */
export async function obtenerSupervisores(proyectoId: string): Promise<SupervisorProyecto[]> {
  const { data } = await http.get<SupervisorProyecto[]>(`/proyectos/${proyectoId}/supervisores`);
  return data;
}

/** Solo el Administrador: supervisores activos que todavía no están en el proyecto. */
export async function buscarSupervisoresDisponibles(proyectoId: string, consulta = ''): Promise<SupervisorDisponible[]> {
  const { data } = await http.get<SupervisorDisponible[]>(`/proyectos/${proyectoId}/supervisores/disponibles`, {
    params: { q: consulta },
  });
  return data;
}

export async function asignarSupervisor(proyectoId: string, usuarioId: string): Promise<SupervisorProyecto> {
  const { data } = await http.post<SupervisorProyecto>(`/proyectos/${proyectoId}/supervisores`, { usuarioId });
  return data;
}

export async function retirarSupervisor(proyectoId: string, usuarioId: string): Promise<void> {
  await http.delete(`/proyectos/${proyectoId}/supervisores/${usuarioId}`);
}