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

/** SGP-110: pide el enlace de restablecimiento. Responde igual exista o no el correo. */
export async function solicitarRestablecimiento(email: string): Promise<void> {
  await http.post('/auth/olvide-mi-contrasena', { email });
}

/** SGP-110 / CP-33: define la nueva contraseña con el token del enlace (un solo uso, 30 min). */
export async function restablecerPassword(token: string, password: string): Promise<void> {
  await http.post('/auth/restablecer-password', { token, password });
}