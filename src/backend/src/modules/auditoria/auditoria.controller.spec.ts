import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ProblemDetailsFilter } from '../../common/filters/problem-details.filter';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';

const PROYECTO = '33333333-3333-4333-8333-333333333333';

/** Validación de filtros con la misma configuración global de main.ts, sin base de datos. */
describe('GET /api/auditoria', () => {
  let app: INestApplication;
  const consultar = jest.fn().mockResolvedValue({ items: [], total: 0, pagina: 1, limite: 20 });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [AuditoriaController],
      providers: [{ provide: AuditoriaService, useValue: { consultar, opciones: jest.fn() } }],
    }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => consultar.mockClear());

  it('sin filtros usa la página 1 con 20 registros', async () => {
    await request(app.getHttpServer()).get('/api/auditoria').expect(200);
    expect(consultar).toHaveBeenCalledWith(expect.objectContaining({ pagina: 1, limite: 20 }));
  });

  it('acepta los filtros de usuario, entidad, proyecto y rango de fechas', async () => {
    await request(app.getHttpServer())
      .get('/api/auditoria')
      .query({
        usuarioId: '22222222-2222-4222-8222-222222222221',
        entidad: 'proyectos',
        proyectoId: PROYECTO,
        desde: '2026-10-01',
        hasta: '2026-10-31',
        pagina: '2',
        limite: '50',
      })
      .expect(200);

    expect(consultar).toHaveBeenCalledWith({
      usuarioId: '22222222-2222-4222-8222-222222222221',
      entidad: 'proyectos',
      proyectoId: PROYECTO,
      desde: '2026-10-01',
      hasta: '2026-10-31',
      pagina: 2,
      limite: 50,
    });
  });

  it('rechaza filtros inválidos con mensajes descriptivos', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auditoria')
      .query({ usuarioId: 'abc', desde: '2026-10-10', hasta: '2026-10-01', limite: '500' })
      .expect(400);

    expect(res.body.detail).toEqual(
      expect.arrayContaining([
        'usuarioId debe ser un UUID válido.',
        'La fecha "hasta" no puede ser anterior a la fecha "desde".',
        'limite admite como máximo 100.',
      ]),
    );
    expect(consultar).not.toHaveBeenCalled();
  });

  it.each(['patch', 'put', 'delete'] as const)('no expone %s sobre la bitácora', async (metodo) => {
    await request(app.getHttpServer())[metodo]('/api/auditoria/1').expect(404);
  });
});
