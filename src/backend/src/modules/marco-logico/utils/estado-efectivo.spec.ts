import { compararCodigos, esFechaValida, estadoEfectivo, estadoSinRetraso, hoyIso, msHastaProximaEjecucion } from './estado-efectivo';

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

  it('guardada como RETRASADA y todavía vencida, sigue retrasada', () => {
    expect(estadoEfectivo('RETRASADA', '2026-10-15', hoy, 40)).toBe('RETRASADA');
  });

  it('guardada como RETRASADA pero con el plazo ampliado, vuelve a En curso o Pendiente según su avance', () => {
    expect(estadoEfectivo('RETRASADA', '2026-12-31', hoy, 40)).toBe('EN_CURSO');
    expect(estadoEfectivo('RETRASADA', '2026-12-31', hoy, 0)).toBe('PENDIENTE');
  });
});

describe('estadoSinRetraso', () => {
  it('En curso si ya tiene avance; Pendiente si no', () => {
    expect(estadoSinRetraso(1)).toBe('EN_CURSO');
    expect(estadoSinRetraso(0)).toBe('PENDIENTE');
  });
});

describe('msHastaProximaEjecucion (revisión diaria a las 00:05)', () => {
  it('a las 23:00 faltan 1 h 5 min', () => {
    expect(msHastaProximaEjecucion(new Date(2026, 10, 13, 23, 0, 0))).toBe(65 * 60 * 1000);
  });

  it('a las 00:05 en punto ya pasó: la siguiente es mañana', () => {
    expect(msHastaProximaEjecucion(new Date(2026, 10, 13, 0, 5, 0))).toBe(24 * 60 * 60 * 1000);
  });

  it('a las 00:00 faltan 5 minutos', () => {
    expect(msHastaProximaEjecucion(new Date(2026, 10, 13, 0, 0, 0))).toBe(5 * 60 * 1000);
  });

  it('cruza fin de mes y de año', () => {
    const ms = msHastaProximaEjecucion(new Date(2026, 11, 31, 12, 0, 0));
    expect(new Date(new Date(2026, 11, 31, 12, 0, 0).getTime() + ms)).toEqual(new Date(2027, 0, 1, 0, 5, 0));
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