import { compare, hash } from 'bcryptjs';
import { BCRYPT_COSTO } from '../constants/auth.constants';

/**
 * Hash de referencia (costo 12) para comparar cuando el correo no existe:
 * así la respuesta tarda lo mismo y no revela qué correos están registrados.
 */
const HASH_SENUELO = '$2b$12$uP/H0ezOhfWidxUPbk3t4usiSSH2Unrh.hcDPDwWCQ8wCcJz3T8qe';

export function hashPassword(plano: string): Promise<string> {
  return hash(plano, BCRYPT_COSTO);
}

export function verificarPassword(plano: string, hashGuardado: string | null | undefined): Promise<boolean> {
  return compare(plano, hashGuardado ?? HASH_SENUELO);
}