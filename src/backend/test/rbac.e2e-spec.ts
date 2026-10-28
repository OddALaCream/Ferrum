import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { borrarProyectosDePrueba } from './helpers/limpieza';

/**
 * SGP-51 (CP-18) y SGP-68 (CP-23): cada rol solo opera en lo que le corresponde.
 * Requiere la BD de desarrollo con migraciones y database/03_usuarios_demo.sql aplicados.
 */
describe('Control de acceso por rol (e2e, RF-18)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const tokens: Record<'admin' | 'supervisor' | 'tecnico', string> = { admin: '', supervisor: '', tecnico: '' };
  const bearer = (rol: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[rol]}` });
  let proyectoId: string;
  let tecnicoId: string;

  const login = async (email: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'Serfamilia2026' })
      .expect(200);
    return res.body.accessToken as string;
  };

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
      .send({
        codigo: `PRY-RBAC-${Date.now()}`.slice(0, 30),
        nombre: 'Proyecto e2e RBAC',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
      })
      .expect(201);
    proyectoId = res.body.id;
  });

  afterAll(async () => {
    await borrarProyectosDePrueba(ds, 'PRY-RBAC-');
    await app.close();
  });

  it('sin sesión cualquier ruta protegida responde 401', async () => {
    await request(app.getHttpServer()).get(`/api/proyectos/${proyectoId}`).expect(401);
  });

  it('el proyecto guarda como creador al Administrador de la sesión', async () => {
    const res = await request(app.getHttpServer()).get(`/api/proyectos/${proyectoId}`).set(bearer('admin')).expect(200);
    const [{ id: adminId }] = await ds.query(`SELECT id FROM usuarios WHERE email = 'admin@serfamilia.test'`);
    expect(res.body.creadoPorId).toBe(adminId);
  });

  it.each([
    ['tecnico', 'crear un proyecto', 'post', '/api/proyectos'],
    ['supervisor', 'crear un proyecto', 'post', '/api/proyectos'],
    ['tecnico', 'cambiar el estado', 'patch', '/estado'],
    ['tecnico', 'registrar el presupuesto', 'patch', '/presupuesto'],
    ['tecnico', 'asignar técnicos', 'post', '/equipo'],
    ['supervisor', 'gestionar usuarios', 'get', '/api/usuarios'],
    ['tecnico', 'ver la bitácora', 'get', '/api/auditoria'],
  ] as const)('CP-18: el %s no puede %s (403)', async (rol, _accion, metodo, ruta) => {
    const url = ruta.startsWith('/api') ? ruta : `/api/proyectos/${proyectoId}${ruta}`;
    await request(app.getHttpServer())[metodo](url).set(bearer(rol)).send({}).expect(403);
  });

  it('CP-18: el Supervisor puede leer el proyecto (200)', async () => {
    await request(app.getHttpServer()).get(`/api/proyectos/${proyectoId}`).set(bearer('supervisor')).expect(200);
  });

  it('CP-23: el Técnico entra solo mientras está asignado; al retirarlo recibe 403', async () => {
    const server = app.getHttpServer();
    await request(server).get(`/api/proyectos/${proyectoId}`).set(bearer('tecnico')).expect(403);

    const asignacion = await request(server)
      .post(`/api/proyectos/${proyectoId}/equipo`)
      .set(bearer('admin'))
      .send({ usuarioId: tecnicoId })
      .expect(201);
    expect(asignacion.body.id).toBe(tecnicoId);
    const [{ asignado_por }] = await ds.query(
      `SELECT asignado_por FROM proyecto_equipo WHERE proyecto_id = $1 AND usuario_id = $2`,
      [proyectoId, tecnicoId],
    );
    const [{ id: adminId }] = await ds.query(`SELECT id FROM usuarios WHERE email = 'admin@serfamilia.test'`);
    expect(asignado_por).toBe(adminId);

    await request(server).get(`/api/proyectos/${proyectoId}`).set(bearer('tecnico')).expect(200);
    await request(server).get(`/api/proyectos/${proyectoId}/equipo`).set(bearer('tecnico')).expect(200);

    await request(server).delete(`/api/proyectos/${proyectoId}/equipo/${tecnicoId}`).set(bearer('admin')).expect(204);
    await request(server).get(`/api/proyectos/${proyectoId}`).set(bearer('tecnico')).expect(403);
  });
});