import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';

/** Requiere la BD de desarrollo con migraciones y seed aplicados (igual que health.e2e-spec). */
describe('Bitácora de auditoría (e2e, RF-34)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const codigo = `PRY-E2E-${Date.now()}`.slice(0, 30);
  let proyectoId: string;
  let token: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    ds = app.get(DataSource);

    // Usuario Administrador de database/03_usuarios_demo.sql
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@serfamilia.test', password: 'Serfamilia2026' })
      .expect(200);
    token = login.body.accessToken;

    const res = await request(app.getHttpServer())
      .post('/api/proyectos')
      .set(auth())
      .set('User-Agent', 'e2e-auditoria')
      .send({
        codigo,
        nombre: 'Proyecto e2e auditoría',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
      })
      .expect(201);
    proyectoId = res.body.id;
    await request(app.getHttpServer())
      .patch(`/api/proyectos/${proyectoId}/estado`)
      .set(auth())
      .send({ estado: 'EN_EJECUCION' })
      .expect(200);
  });

  afterAll(() => app.close());

  it('CP-34: cada escritura queda con acción, entidad, fecha, IP y valores anterior/nuevo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auditoria')
      .set(auth())
      .query({ proyectoId, entidad: 'proyectos' })
      .expect(200);

    expect(res.body.total).toBe(2);
    const [actualizacion, creacion] = res.body.items;
    expect(creacion).toMatchObject({
      accion: 'CREAR',
      entidad: 'proyectos',
      entidadId: proyectoId,
      proyectoCodigo: codigo,
      valorAnterior: null,
      userAgent: 'e2e-auditoria',
    });
    expect(creacion.valorNuevo).toMatchObject({ codigo, estado: 'PLANIFICACION' });
    expect(actualizacion).toMatchObject({
      accion: 'ACTUALIZAR',
      valorAnterior: { estado: 'PLANIFICACION' },
      valorNuevo: { estado: 'EN_EJECUCION' },
    });
    expect(actualizacion.ip).toEqual(expect.any(String));
    expect(new Date(actualizacion.fecha).getTime()).not.toBeNaN();
  });

  it('una operación rechazada no deja registro', async () => {
    await request(app.getHttpServer())
      .post('/api/proyectos')
      .set(auth())
      .send({
        codigo,
        nombre: 'Duplicado',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
      })
      .expect(409);

    const res = await request(app.getHttpServer()).get('/api/auditoria').set(auth()).query({ proyectoId }).expect(200);
    expect(res.body.total).toBe(2);
  });

  it('CP-N05: la base de datos rechaza UPDATE y DELETE sobre audit_log', async () => {
    await expect(ds.query(`UPDATE audit_log SET accion = 'X' WHERE proyecto_id = $1`, [proyectoId])).rejects.toThrow();
    await expect(ds.query(`DELETE FROM audit_log WHERE proyecto_id = $1`, [proyectoId])).rejects.toThrow();
  });
});