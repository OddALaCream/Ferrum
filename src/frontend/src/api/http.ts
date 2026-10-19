import axios from 'axios';

/**
 * Cliente HTTP único de la SPA.
 * - baseURL '/api': en desarrollo lo reenvía el proxy de Vite; en producción, Nginx.
 * - withCredentials: el refresh token viaja en cookie HttpOnly (ADR-004).
 * El access token (15 min) vivirá en memoria (store de auth) y se agregará aquí
 * con un interceptor cuando se implemente el login (SGP-4 / SGP-41).
 */
export const http = axios.create({ baseURL: '/api', withCredentials: true, timeout: 15_000 });
