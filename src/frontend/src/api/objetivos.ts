import { http } from './http';

/** Objetivo específico vinculado a un proyecto (SGP-162). */
export interface ObjetivoEspecifico {
  id: string;
  proyectoId: string;
  codigo: string;
  descripcion: string;
  createdAt: string;
  updatedAt: string;
}

export interface NuevoObjetivoEspecifico {
  codigo: string;
  descripcion: string;
}

export async function obtenerObjetivos(proyectoId: string): Promise<ObjetivoEspecifico[]> {
  const { data } = await http.get<ObjetivoEspecifico[]>(`/proyectos/${proyectoId}/objetivos`);
  return data;
}

export async function crearObjetivo(
  proyectoId: string,
  dto: NuevoObjetivoEspecifico,
): Promise<ObjetivoEspecifico> {
  const { data } = await http.post<ObjetivoEspecifico>(`/proyectos/${proyectoId}/objetivos`, dto);
  return data;
}
