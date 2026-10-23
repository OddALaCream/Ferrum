import { describe, expect, it } from 'vitest';
import { motivoMontoInvalido } from './proyectos';

describe('motivoMontoInvalido', () => {
  it.each([
    ['850000.50', null],
    ['0', null],
    ['999999999999.99', null],
    ['-5', 'El monto del presupuesto no puede ser negativo.'],
    ['', 'El monto del presupuesto es obligatorio.'],
    ['10.505', 'El monto del presupuesto admite como máximo 12 dígitos enteros y 2 decimales.'],
    ['850.000,50', 'El monto del presupuesto debe ser un número con punto decimal (p. ej. 850000.50).'],
  ])('%p → %p', (monto, esperado) => {
    expect(motivoMontoInvalido(monto)).toBe(esperado);
  });
});
