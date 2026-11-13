import { DataSource } from 'typeorm';
import { ProcesoRetrasosService } from './proceso-retrasos.service';

describe('ProcesoRetrasosService (SGP-113)', () => {
  const query = jest.fn();
  const servicio = new ProcesoRetrasosService({ query } as unknown as DataSource);

  beforeEach(() => query.mockReset());
  afterEach(() => servicio.onApplicationShutdown());

  it('marca como retrasadas las vencidas sin completar y reabre las de plazo ampliado', async () => {
    query.mockResolvedValueOnce([{ n: 3 }]).mockResolvedValueOnce([{ n: 1 }]);

    await expect(servicio.ejecutar()).resolves.toEqual({ marcadas: 3, reabiertas: 1 });

    const [marcar, reabrir] = query.mock.calls.map((c) => String(c[0]));
    expect(marcar).toContain(`SET estado = 'RETRASADA'`);
    expect(marcar).toContain(`a.estado IN ('PENDIENTE', 'EN_CURSO')`);
    expect(marcar).toContain('a.fecha_fin < CURRENT_DATE');
    expect(marcar).toContain(`p.estado <> 'CERRADO'`);
    expect(reabrir).toContain(`WHERE estado = 'RETRASADA' AND fecha_fin >= CURRENT_DATE`);
  });

  it('al arrancar no ejecuta nada: solo programa la próxima revisión, sin impedir que el servidor se apague', () => {
    jest.useFakeTimers();
    try {
      servicio.onApplicationBootstrap();
      expect(query).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(1);
      servicio.onApplicationShutdown();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('a la hora programada ejecuta la revisión y vuelve a programarse para el día siguiente', async () => {
    jest.useFakeTimers();
    try {
      query.mockResolvedValue([{ n: 0 }]);
      servicio.onApplicationBootstrap();
      await jest.runOnlyPendingTimersAsync();
      expect(query).toHaveBeenCalledTimes(2);
      expect(jest.getTimerCount()).toBe(1);
    } finally {
      servicio.onApplicationShutdown();
      jest.useRealTimers();
    }
  });
});