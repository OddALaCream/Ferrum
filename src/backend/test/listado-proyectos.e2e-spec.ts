import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { borrarProyectosDePrueba } from './helpers/limpieza';

/**
 * SGP-71 / RF-04: listado de proyectos y panel de indicadores, con alcance por rol (RN-10).
 * Requiere la BD con migraciones y database/03_usuarios_demo.sql aplicados.
 */
describe('Listado de proyectos e indicadores (e2e, RF-04)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const tokens = { admin: '', supervisor: '', tecnico: '' };
  const bearer = (rol: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[rol]}` });
  const codigo = `LIST-${Date.now()}`.slice(0, 30);
  let proyectoId: string;
  let tecnicoId: string;

  const login = async (email: string) =>
    (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'Serfamilia2026' })
        .expect(200)
    ).body.accessToken as string;

  const listar = (rol: keyof typeof tokens, query: Record<string, string | number> = {}) =>
    request(app.getHttpServer()).get('/api/proyectos').query(query).set(bearer(rol));

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    ds = app.get(DataSource);

    tokens.admin = await login('admin@serfamilia.test');
    tokens.supervisor = await login('supervisor@serfamilia.test');
    tokens.tecnico = await login('tecnico@serfamilia.test');
    [{ id: tecnicoId }] = await ds.query(`SELECT id FROM usuarios WHERE email = 'tecnico@serfamilia.test'`);

    const res = await request(app.getHttpServer())
      .post('/api/proyectos')
      .set(bearer('admin'))
      .send({ codigo, nombre: 'Proyecto para el listado', fechaInicio: '2026-11-01', fechaFin: '2027-03-31' })
      .expect(201);
    proyectoId = res.body.id;
  });

  afterAll(async () => {
    await borrarProyectosDePrueba(ds, 'LIST-');
    await app.close();
  });

  it('el Administrador encuentra el proyecto por código y recibe los datos de la fila', async () => {
    const res = await listar('admin', { q: codigo }).expect(200);
    expect(res.body).toMatchObject({ total: 1, page: 1, limit: 10 });
    expect(res.body.items[0]).toMatchObject({
      id: proyectoId,
      codigo,
      nombre: 'Proyecto para el listado',
      estado: 'PLANIFICACION',
      moneda: 'BOB',
      equipoActivo: 0,
    });
  });

  it('busca por nombre sin importar mayúsculas y filtra por estado', async () => {
    expect((await listar('admin', { q: 'PARA EL LISTADO', estado: 'PLANIFICACION' }).expect(200)).body.items.map((p: { id: string }) => p.id)).toContain(proyectoId);
    expect((await listar('admin', { q: codigo, estado: 'CERRADO' }).expect(200)).body.total).toBe(0);
  });

  it('pagina: limit=1 devuelve una fila y el total completo', async () => {
    const res = await listar('admin', { limit: 1, page: 1 }).expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.limit).toBe(1);
  });

  it('rechaza filtros inválidos con 400', async () => {
    await listar('admin', { estado: 'INVENTADO' }).expect(400);
    await listar('admin', { limit: 500 }).expect(400);
    await listar('admin', { page: 0 }).expect(400);
  });

  it('el Supervisor también ve el proyecto', async () => {
    expect((await listar('supervisor', { q: codigo }).expect(200)).body.total).toBe(1);
  });

  it('RN-10: el Técnico no ve el proyecto hasta que lo asignan, y deja de verlo al retirarlo', async () => {
    const server = app.getHttpServer();
    expect((await listar('tecnico', { q: codigo }).expect(200)).body.total).toBe(0);

    await request(server).post(`/api/proyectos/${proyectoId}/equipo`).set(bearer('admin')).send({ usuarioId: tecnicoId }).expect(201);
    const asignado = await listar('tecnico', { q: codigo }).expect(200);
    expect(asignado.body.total).toBe(1);
    expect(asignado.body.items[0].equipoActivo).toBe(1);

    await request(server).delete(`/api/proyectos/${proyectoId}/equipo/${tecnicoId}`).set(bearer('admin')).expect(204);
    expect((await listar('tecnico', { q: codigo }).expect(200)).body.total).toBe(0);
  });

  it('sin sesión el listado responde 401', async () => {
    await request(app.getHttpServer()).get('/api/proyectos').expect(401);
  });

  describe('indicadores (GET /proyectos/resumen)', () => {
    it('devuelve los totales por estado y el presupuesto en bolivianos', async () => {
      await request(app.getHttpServer())
        .patch(`/api/proyectos/${proyectoId}/presupuesto`)
        .set(bearer('admin'))
        .send({ monto: '1000.50', moneda: 'BOB' })
        .expect(200);

      const res = await request(app.getHttpServer()).get('/api/proyectos/resumen').set(bearer('admin')).expect(200);
      expect(res.body.totalProyectos).toBeGreaterThanOrEqual(1);
      expect(Object.keys(res.body.porEstado).sort()).toEqual(['CERRADO', 'EN_EJECUCION', 'PAUSADO', 'PLANIFICACION']);
      expect(res.body.porEstado.PLANIFICACION).toBeGreaterThanOrEqual(1);
      expect(Number(res.body.presupuestoBob)).toBeGreaterThanOrEqual(1000.5);
      expect(res.body.presupuestoBob).toMatch(/^\d+\.\d{2}$/);
      const suma = Object.values(res.body.porEstado as Record<string, number>).reduce((a, b) => a + b, 0);
      expect(suma).toBe(res.body.totalProyectos);
    });

    it('el Técnico solo cuenta sus proyectos asignados', async () => {
      const admin = await request(app.getHttpServer()).get('/api/proyectos/resumen').set(bearer('admin')).expect(200);
      const tecnico = await request(app.getHttpServer()).get('/api/proyectos/resumen').set(bearer('tecnico')).expect(200);
      expect(tecnico.body.totalProyectos).toBeLessThanOrEqual(admin.body.totalProyectos);
      // Cuenta a los técnicos de sus propios proyectos (él y sus compañeros), nunca más que el total de la fundación
      expect(tecnico.body.tecnicosActivos).toBeLessThanOrEqual(admin.body.tecnicosActivos);
    });
  });
});