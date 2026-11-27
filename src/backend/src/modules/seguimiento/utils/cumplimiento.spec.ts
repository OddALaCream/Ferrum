import { cumplimientoIov, promedioPonderado, valorActualIov } from './cumplimiento';

describe('Cumplimiento (SGP-95)', () => {
  describe('indicador', () => {
    it('CP-14: base 0, meta 130 y 65 aprobados → 50 %', () => {
      expect(cumplimientoIov(0, 130, 65)).toBe(50);
      expect(valorActualIov(0, 130, 65)).toBe(65);
    });

    it('parte de la línea base', () => {
      expect(cumplimientoIov(20, 120, 50)).toBe(50);
      expect(valorActualIov(20, 120, 50)).toBe(70);
    });

    it('sin avances aprobados es 0 %', () => {
      expect(cumplimientoIov(0, 130, 0)).toBe(0);
      expect(valorActualIov(10, 130, 0)).toBe(10);
    });

    it('no pasa de 100 % aunque se supere la meta', () => {
      expect(cumplimientoIov(0, 100, 150)).toBe(100);
      expect(valorActualIov(0, 100, 150)).toBe(150);
    });

    it('meta de reducción: de 40 a 10 casos, con 15 de reducción aprobada → 50 %', () => {
      expect(cumplimientoIov(40, 10, 15)).toBe(50);
      expect(valorActualIov(40, 10, 15)).toBe(25);
    });

    it('redondea a 2 decimales', () => {
      expect(cumplimientoIov(0, 3, 1)).toBe(33.33);
    });
  });

  describe('promedio ponderado (resultado y proyecto)', () => {
    it('CP-14: indicador A al 50 % y B al 100 %, peso 50 cada uno → resultado al 75 %', () => {
      expect(promedioPonderado([{ pct: 50, peso: 50 }, { pct: 100, peso: 50 }])).toBe(75);
    });

    it('respeta pesos distintos', () => {
      expect(promedioPonderado([{ pct: 100, peso: 30 }, { pct: 0, peso: 70 }])).toBe(30);
    });

    it('si nadie tiene peso, usa el promedio simple', () => {
      expect(promedioPonderado([{ pct: 40, peso: 0 }, { pct: 80, peso: 0 }])).toBe(60);
    });

    it('sin elementos es 0 %', () => {
      expect(promedioPonderado([])).toBe(0);
    });
  });
});