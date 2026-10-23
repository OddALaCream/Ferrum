/** Enum `moneda_tipo` de PostgreSQL (RF-02). */
export const MONEDAS = ['BOB', 'USD', 'EUR'] as const;
export type Moneda = (typeof MONEDAS)[number];

/** NUMERIC(14,2): hasta 12 dígitos enteros y 2 decimales. */
export const MONTO_MAXIMO = '999999999999.99';

const FORMATO_MONTO = /^\d{1,12}(\.\d{1,2})?$/;

/**
 * Devuelve el motivo por el que un monto no es válido, o `null` si lo es.
 * El monto se maneja como texto para no perder precisión con números de coma flotante.
 */
export function motivoMontoInvalido(valor: unknown): string | null {
  if (valor === undefined || valor === null || valor === '') {
    return 'El monto del presupuesto es obligatorio.';
  }
  if (typeof valor !== 'string') {
    return 'El monto del presupuesto debe ser un número.';
  }
  if (valor.trim().startsWith('-')) {
    return 'El monto del presupuesto no puede ser negativo.';
  }
  if (!/^\d+(\.\d+)?$/.test(valor)) {
    return 'El monto del presupuesto debe ser un número con punto decimal (p. ej. 850000.50).';
  }
  if (!FORMATO_MONTO.test(valor)) {
    return 'El monto del presupuesto admite como máximo 12 dígitos enteros y 2 decimales.';
  }
  return null;
}

/** Normaliza un monto ya validado a exactamente dos decimales: "850000.5" → "850000.50". */
export function normalizarMonto(valor: string): string {
  const [enteros, decimales = ''] = valor.split('.');
  return `${BigInt(enteros).toString()}.${decimales.padEnd(2, '0')}`;
}
