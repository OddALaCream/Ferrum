import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProblemDetailsFilter } from '../../common/filters/problem-details.filter';
import { ProyectoEquipo } from './entities/proyecto-equipo.entity';
import { ProyectosController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';

const ID = '33333333-3333-4333-8333-333333333333';

/** Prueba HTTP del endpoint con la misma configuración global de main.ts, sin base de datos. */
describe('PATCH /api/proyectos/:id/presupuesto', () => {
  let app: INestApplication;
  const registrarPresupuesto = jest.fn();

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [ProyectosController],
      providers: [
        { provide: ProyectosService, useValue: { registrarPresupuesto } },
        // Lo necesita el AlcanceProyectoGuard de GET /proyectos/:id
        { provide: getRepositoryToken(ProyectoEquipo), useValue: { exists: jest.fn() } },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => registrarPresupuesto.mockReset());

  it('CP-02: registra 850 000,50 BOB y devuelve el monto exacto', async () => {
    registrarPresupuesto.mockResolvedValue({ id: ID, presupuestoTotal: '850000.50', moneda: 'BOB' });

    const res = await request(app.getHttpServer())
      .patch(`/api/proyectos/${ID}/presupuesto`)
      .send({ monto: '850000.50', moneda: 'BOB' })
      .expect(200);

    expect(registrarPresupuesto).toHaveBeenCalledWith(ID, { monto: '850000.50', moneda: 'BOB' });
    expect(res.body).toMatchObject({ presupuestoTotal: '850000.50', moneda: 'BOB' });
  });

  it('CP-02: rechaza un monto negativo con 400 y mensaje descriptivo (RFC 7807)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/proyectos/${ID}/presupuesto`)
      .send({ monto: '-100.00', moneda: 'BOB' })
      .expect(400);

    expect(res.body).toMatchObject({
      status: 400,
      detail: ['El monto del presupuesto no puede ser negativo.'],
    });
    expect(registrarPresupuesto).not.toHaveBeenCalled();
  });

  it('rechaza un id que no es UUID', async () => {
    await request(app.getHttpServer())
      .patch('/api/proyectos/no-es-uuid/presupuesto')
      .send({ monto: '1', moneda: 'BOB' })
      .expect(400);
    expect(registrarPresupuesto).not.toHaveBeenCalled();
  });

  it('rechaza campos no permitidos', async () => {
    await request(app.getHttpServer())
      .patch(`/api/proyectos/${ID}/presupuesto`)
      .send({ monto: '1', moneda: 'BOB', estado: 'CERRADO' })
      .expect(400);
  });
});