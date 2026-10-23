import type { RolApi } from './auth';
import { http } from './http';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: RolApi;
  activo: boolean;
  /** Bloqueado temporalmente por 5 intentos fallidos. */
  bloqueado: boolean;
  debeCambiarPassword: boolean;
  /** ISO 8601 o null si nunca ingresó. */
  ultimoLoginAt: string | null;
  createdAt: string;
}

export interface FiltrosUsuarios {
  q?: string;
  rol?: RolApi;
  activo?: boolean;
}

export interface NuevoUsuario {
  nombre: string;
  email: string;
  rol: RolApi;
  password: string;
}

export type CambiosUsuario = Partial<Pick<Usuario, 'nombre' | 'email' | 'rol' | 'activo'>>;

export const ETIQUETA_ROL: Record<RolApi, string> = {
  ADMINISTRADOR: 'Administrador',
  SUPERVISOR: 'Supervisor operativo',
  TECNICO: 'Técnico de campo',
};

export async function listarUsuarios(filtros: FiltrosUsuarios = {}): Promise<Usuario[]> {
  const { data } = await http.get<Usuario[]>('/usuarios', { params: filtros });
  return data;
}

export async function crearUsuario(datos: NuevoUsuario): Promise<Usuario> {
  const { data } = await http.post<Usuario>('/usuarios', datos);
  return data;
}

export async function editarUsuario(id: string, cambios: CambiosUsuario): Promise<Usuario> {
  const { data } = await http.patch<Usuario>(`/usuarios/${id}`, cambios);
  return data;
}

export async function restablecerPassword(id: string, password: string): Promise<void> {
  await http.patch(`/usuarios/${id}/password`, { password });
}

export async function eliminarUsuario(id: string): Promise<void> {
  await http.delete(`/usuarios/${id}`);
}