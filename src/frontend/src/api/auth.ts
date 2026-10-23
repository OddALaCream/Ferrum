import { http } from './http';

/** Enum `rol_usuario` de PostgreSQL. */
export type RolApi = 'ADMINISTRADOR' | 'SUPERVISOR' | 'TECNICO';

export interface UsuarioApi {
  id: string;
  email: string;
  nombre: string;
  rol: RolApi;
  debeCambiarPassword: boolean;
}

/** Respuesta de /auth/login y /auth/refresh. El refresh token viaja en una cookie HttpOnly. */
export interface RespuestaSesion {
  accessToken: string;
  /** Segundos de vida del access token. */
  expiraEn: number;
  usuario: UsuarioApi;
}

export async function iniciarSesion(email: string, password: string): Promise<RespuestaSesion> {
  const { data } = await http.post<RespuestaSesion>('/auth/login', { email, password });
  return data;
}

export async function renovarSesion(): Promise<RespuestaSesion> {
  const { data } = await http.post<RespuestaSesion>('/auth/refresh');
  return data;
}

export async function cerrarSesion(): Promise<void> {
  await http.post('/auth/logout');
}