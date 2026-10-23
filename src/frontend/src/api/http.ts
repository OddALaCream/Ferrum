import axios, { type AxiosRequestConfig } from 'axios';

/**
 * Cliente HTTP único de la SPA.
 * - baseURL '/api': en desarrollo lo reenvía el proxy de Vite; en producción, Nginx.
 * - withCredentials: el refresh token viaja en cookie HttpOnly (ADR-004).
 * - El access token (15 min) vive en memoria (store de auth) y se agrega en cada petición.
 */
export const http = axios.create({ baseURL: '/api', withCredentials: true, timeout: 15_000 });

/** Lo que el cliente HTTP necesita saber de la sesión. Lo conecta main.ts con el store de auth. */
export interface ManejadorSesion {
  token(): string | null;
  /** Pide un access token nuevo con la cookie de refresh; null si la sesión ya no es válida. */
  renovar(): Promise<string | null>;
  /** La sesión venció y no se pudo renovar. */
  alExpirar(): void;
}

let sesion: ManejadorSesion | null = null;

export function conectarSesion(manejador: ManejadorSesion | null) {
  sesion = manejador;
}

type ConfigConReintento = AxiosRequestConfig & { _reintento?: boolean };

/** Las rutas de auth resuelven su propio 401; reintentarlas crearía un bucle. */
const esRutaAuth = (url?: string) => !!url && url.startsWith('/auth/');

http.interceptors.request.use((config) => {
  const token = sesion?.token();
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(undefined, async (error) => {
  const config = error.config as ConfigConReintento | undefined;
  if (!sesion || !config || error.response?.status !== 401 || esRutaAuth(config.url) || config._reintento) {
    throw error;
  }
  config._reintento = true;
  const nuevo = await sesion.renovar();
  if (!nuevo) {
    sesion.alExpirar();
    throw error;
  }
  config.headers = { ...config.headers, Authorization: `Bearer ${nuevo}` };
  return http.request(config);
});