const UNIDADES: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Convierte '15m', '7d', '12h' o '30s' (formato de JWT_*_TTL) a milisegundos. */
export function duracionAMs(valor: string): number {
  const m = /^(\d+)\s*([smhd])$/.exec(valor.trim());
  if (!m) throw new Error(`Duración inválida: "${valor}". Use por ejemplo 15m, 12h o 7d.`);
  return Number(m[1]) * UNIDADES[m[2]];
}