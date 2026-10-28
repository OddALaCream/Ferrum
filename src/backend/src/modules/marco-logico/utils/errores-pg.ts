import { QueryFailedError } from 'typeorm';

/** Código SQLSTATE de un error de PostgreSQL ("23505" = valor duplicado). */
export function codigoPg(e: unknown): string | undefined {
  return e instanceof QueryFailedError ? (e.driverError as { code?: string } | undefined)?.code : undefined;
}

/**
 * ¿El error es "no se puede borrar porque otra tabla lo referencia"?
 * Según la versión de PostgreSQL, una clave foránea con ON DELETE RESTRICT responde
 * 23503 (foreign_key_violation) o 23001 (restrict_violation); las dos significan lo mismo.
 */
export function esViolacionFk(e: unknown): boolean {
  const codigo = codigoPg(e);
  return codigo === '23503' || codigo === '23001';
}