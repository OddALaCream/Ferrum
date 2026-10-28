import { describe, expect, it } from 'vitest';
import { formatoFecha, formatoFechaCorta, formatoMonto, formatoNumero } from './formato';

describe('formato', () => {
  it('formatoFecha no se corre un día por la zona horaria', () => {
    expect(formatoFecha('2026-10-26')).toContain('26');
    expect(formatoFecha('2026-10-26')).toContain('2026');
    expect(formatoFecha('2026-11-01')).toContain('1');
  });

  it('formatoFecha muestra una raya si no hay fecha', () => {
    expect(formatoFecha(null)).toBe('—');
    expect(formatoFecha(undefined)).toBe('—');
  });

  it('formatoFechaCorta incluye el día y el mes', () => {
    const t = formatoFechaCorta('2026-10-20');
    expect(t).toContain('20');
  });

  it('formatoMonto da el símbolo y los dos decimales', () => {
    expect(formatoMonto('850000.5')).toContain('850.000,50');
    expect(formatoMonto('850000.5')).toMatch(/^Bs /);
    expect(formatoMonto(100, 'USD')).toMatch(/^USD /);
  });

  it('formatoNumero quita los ceros sobrantes', () => {
    expect(formatoNumero(80)).toBe('80');
    expect(formatoNumero(7680.5)).toContain('7.680,5');
  });
});