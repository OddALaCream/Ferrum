import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegistrarPresupuestoDto } from './registrar-presupuesto.dto';

async function errores(cuerpo: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(RegistrarPresupuestoDto, cuerpo);
  const resultado = await validate(dto);
  return resultado.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('RegistrarPresupuestoDto', () => {
  it('CP-02: acepta 850 000,50 BOB enviado como texto', async () => {
    expect(await errores({ monto: '850000.50', moneda: 'BOB' })).toEqual([]);
  });

  it('acepta el monto enviado como número JSON y lo convierte a texto', async () => {
    const dto = plainToInstance(RegistrarPresupuestoDto, { monto: 850000.5, moneda: 'USD' });
    expect(dto.monto).toBe('850000.5');
    expect(await validate(dto)).toEqual([]);
  });

  it.each(['BOB', 'USD', 'EUR'])('acepta la moneda %s', async (moneda) => {
    expect(await errores({ monto: '100', moneda })).toEqual([]);
  });

  it('acepta cero y el máximo de NUMERIC(14,2)', async () => {
    expect(await errores({ monto: '0', moneda: 'BOB' })).toEqual([]);
    expect(await errores({ monto: '999999999999.99', moneda: 'BOB' })).toEqual([]);
  });

  it.each([['-1'], [-0.01], ['-850000.50']])('CP-02: rechaza el monto negativo %p con mensaje descriptivo', async (monto) => {
    expect(await errores({ monto, moneda: 'BOB' })).toEqual(['El monto del presupuesto no puede ser negativo.']);
  });

  it('rechaza más de dos decimales', async () => {
    expect(await errores({ monto: '10.505', moneda: 'BOB' })).toEqual([
      'El monto del presupuesto admite como máximo 12 dígitos enteros y 2 decimales.',
    ]);
  });

  it('rechaza más de 12 dígitos enteros', async () => {
    expect(await errores({ monto: '1000000000000', moneda: 'BOB' })).toEqual([
      'El monto del presupuesto admite como máximo 12 dígitos enteros y 2 decimales.',
    ]);
  });

  it.each(['850.000,50', 'abc', '1e5', '12.'])('rechaza el formato inválido %p', async (monto) => {
    expect(await errores({ monto, moneda: 'BOB' })).toEqual([
      'El monto del presupuesto debe ser un número con punto decimal (p. ej. 850000.50).',
    ]);
  });

  it('exige el monto', async () => {
    expect(await errores({ moneda: 'BOB' })).toEqual(['El monto del presupuesto es obligatorio.']);
  });

  it('rechaza una moneda no admitida', async () => {
    expect(await errores({ monto: '100', moneda: 'ARS' })).toEqual(['La moneda debe ser una de: BOB, USD, EUR.']);
  });
});
