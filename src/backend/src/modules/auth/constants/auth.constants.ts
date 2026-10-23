/** CP-17: al quinto intento fallido seguido la cuenta se bloquea 15 minutos. */
export const MAX_INTENTOS_FALLIDOS = 5;
export const MINUTOS_BLOQUEO = 15;

/** SGP-39: costo mínimo de bcrypt. */
export const BCRYPT_COSTO = 12;

/** Cookie HttpOnly del refresh token (ADR-004). Solo se envía a /api/auth. */
export const COOKIE_REFRESH = 'sgp_rt';
export const RUTA_COOKIE_REFRESH = '/api/auth';

/** SGP-110 / CP-33: el enlace de restablecimiento es de un solo uso y dura 30 minutos. */
export const MINUTOS_VIGENCIA_RESET = 30;