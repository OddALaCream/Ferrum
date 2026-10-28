import { compararCodigos, esFechaValida, estadoEfectivo, hoyIso } from './estado-efectivo';

describe('estadoEfectivo (RN-11)', () => {
  const hoy = '2026-10-26';

  it('una actividad vencida y sin completar se ve RETRASADA', () => {
    expect(estadoEfectivo('PENDIENTE', '2026-10-15', hoy)).toBe('RETRASADA');
    expect(estadoEfectivo('EN_CURSO', '2026-10-25', hoy)).toBe('RETRASADA');
  });

  it('el día de vencimiento todavía no está retrasada', () => {
    expect(estadoEfectivo('EN_CURSO', '2026-10-26', hoy)).toBe('EN_CURSO');
  });

  it('una actividad completada nunca se ve retrasada, aunque haya vencido', () => {
    expect(estadoEfectivo('COMPLETADA', '2026-01-01', hoy)).toBe('COMPLETADA');
  });

  it('una actividad con plazo por delante conserva su estado', () => {
    expect(estadoEfectivo('PENDIENTE', '2027-01-31', hoy)).toBe('PENDIENTE');
  });
});

describe('hoyIso', () => {
  it('da la fecha local como YYYY-MM-DD', () => {
    expect(hoyIso(new Date(2026, 9, 6))).toBe('2026-10-06');
    expect(hoyIso(new Date(2027, 0, 31))).toBe('2027-01-31');
  });
});

describe('compararCodigos', () => {
  it('ordena de forma natural: R.2 antes que R.10 y A.1.2 antes que A.1.10', () => {
    expect(['R.10', 'R.2', 'R.1'].sort(compararCodigos)).toEqual(['R.1', 'R.2', 'R.10']);
    expect(['A.1.10', 'A.1.2', 'A.1.1'].sort(compararCodigos)).toEqual(['A.1.1', 'A.1.2', 'A.1.10']);
  });
});

describe('esFechaValida', () => {
  it('acepta fechas reales y rechaza las que no existen en el calendario', () => {
    expect(esFechaValida('2026-02-28')).toBe(true);
    expect(esFechaValida('2028-02-29')).toBe(true);
    expect(esFechaValida('2026-02-31')).toBe(false);
    expect(esFechaValida('2026-13-01')).toBe(false);
  });
});