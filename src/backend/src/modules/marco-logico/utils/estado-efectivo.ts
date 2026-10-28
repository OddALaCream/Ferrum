import type { EstadoActividad } from '../entities/actividad.entity';

/** Fecha de hoy como YYYY-MM-DD en hora local (las fechas del marco lógico no llevan hora). */
export function hoyIso(ahora: Date = new Date()): string {
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/** RN-11: una actividad cuya fecha de fin ya pasó y no está completada se considera RETRASADA. */
export function estadoEfectivo(estado: EstadoActividad, fechaFin: string, hoy: string = hoyIso()): EstadoActividad {
  return estado !== 'COMPLETADA' && fechaFin < hoy ? 'RETRASADA' : estado;
}

/** Orden natural de códigos: R.2 antes que R.10, A.1.2 antes que A.1.10. */
export const compararCodigos = (a: string, b: string): number => a.localeCompare(b, 'es', { numeric: true });

/** ¿Es una fecha real del calendario? ("2026-02-31" no lo es.) */
export function esFechaValida(iso: string): boolean {
  const [a, m, d] = iso.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}