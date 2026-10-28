/** Fecha ISO (YYYY-MM-DD) → "26 oct 2026", sin desplazarse por la zona horaria. */
export function formatoFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(a, m - 1, d));
}

/** Fecha corta para las sesiones: "mar 26 oct". */
export function formatoFechaCorta(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('es-BO', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(a, m - 1, d));
}

/** Monto como texto ("850000.50") → "Bs 850.000,50". */
export function formatoMonto(monto: string | number, moneda = 'BOB'): string {
  const n = typeof monto === 'string' ? Number(monto) : monto;
  const simbolo = moneda === 'BOB' ? 'Bs' : moneda;
  return `${simbolo} ${new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

/** Cantidad sin ceros sobrantes: 80.00 → "80", 7680.5 → "7.680,5". */
export function formatoNumero(n: number): string {
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 }).format(n);
}