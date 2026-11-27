/**
 * SGP-95: fórmulas del % de cumplimiento. Solo cuentan los avances APROBADOS.
 *
 * - Indicador: cuánto se avanzó desde la línea base hacia la meta. Cada avance reporta lo logrado en su
 *   periodo, así que el valor actual es la línea base más lo aprobado (o menos, si la meta es reducir algo).
 * - Resultado: promedio de sus indicadores ponderado por su peso.
 * - Proyecto: promedio de sus resultados ponderado por su peso.
 * Si ningún elemento tiene peso, se usa el promedio simple. Siempre entre 0 y 100, con 2 decimales.
 */

export interface Ponderable {
  pct: number;
  peso: number;
}

export const redondear2 = (n: number): number => Math.round(n * 100) / 100;

const acotar = (n: number): number => Math.min(100, Math.max(0, n));

/** Valor que alcanza el indicador con lo aprobado: sube hacia la meta o baja si la meta es menor que la base. */
export function valorActualIov(lineaBase: number, meta: number, sumaAprobada: number): number {
  return redondear2(lineaBase + Math.sign(meta - lineaBase) * sumaAprobada);
}

/** CP-14: base 0, meta 130 y 65 aprobados → 50 %. */
export function cumplimientoIov(lineaBase: number, meta: number, sumaAprobada: number): number {
  const recorrido = Math.abs(meta - lineaBase);
  if (recorrido === 0) return 0;
  return redondear2(acotar((sumaAprobada / recorrido) * 100));
}

/** CP-14: un indicador al 50 % y otro al 100 %, ambos con peso 50 → 75 %. */
export function promedioPonderado(items: readonly Ponderable[]): number {
  if (items.length === 0) return 0;
  const pesoTotal = items.reduce((s, i) => s + i.peso, 0);
  const valor =
    pesoTotal > 0
      ? items.reduce((s, i) => s + i.pct * i.peso, 0) / pesoTotal
      : items.reduce((s, i) => s + i.pct, 0) / items.length;
  return redondear2(acotar(valor));
}