import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { StorageAdapter } from '../src/infrastructure/storage/storage.adapter';
import { hoyIso } from '../src/modules/marco-logico/utils/estado-efectivo';
import { borrarProyectosDePrueba } from './helpers/limpieza';

/** Almacenamiento que no guarda nada: aquí solo importa el cálculo. */
class AlmacenamientoNulo extends StorageAdapter {
  async upload() {}
  async presignedDownloadUrl(key: string) {
    return `http://almacen.test/${key}`;
  }
  async remove() {}
  async ping() {}
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

/**
 * SGP-95: % de cumplimiento automático. Proyecto con dos resultados:
 *   R.1 (peso 60): A (meta 130, peso 50) y B (meta 10, peso 50)
 *   R.2 (peso 40): C (meta 20, peso 100)
 */
describe('Cumplimiento automático (e2e, SGP-95)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const tokens = { admin: '', lucia: '' };
  const ids = { proyecto: '', r1: '', r2: '', a: '', b: '', c: '', lucia: '' };
  const codigo = `CU-${Date.now()}`.slice(0, 26);
  const hoy = hoyIso();
  const http = () => app.getHttpServer();
  const bearer = (r: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[r]}` });
  const base = () => `/api/proyectos/${ids.proyecto}`;
  const login = async (email: string) =>
    (await request(http()).post('/api/auth/login').send({ email, password: 'Serfamilia2026' }).expect(200)).body.accessToken as string;

  /** La técnica registra, adjunta y envía; devuelve el id del avance enviado. */
  const enviado = async (iovId: string, valorReportado: number) => {
    const id = (await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId, valorReportado, fechaCorte: hoy }).expect(201)).body.id as string;
    await request(http()).post(`${base()}/avances/${id}/evidencias`).set(bearer('lucia')).attach('archivo', PNG, 'acta.png').expect(201);
    await request(http()).post(`${base()}/avances/${id}/enviar`).set(bearer('lucia')).expect(200);
    return id;
  };
  const aprobar = (id: string) => request(http()).patch(`${base()}/avances/${id}/aprobar`).set(bearer('admin')).expect(200);

  /** Lee los % tal como los entrega el marco lógico. */
  const estado = async () => {
    const arbol = (await request(http()).get(`${base()}/marco-logico`).set(bearer('admin')).expect(200)).body;
    const res = (id: string) => arbol.resultados.find((r: { id: string }) => r.id === id);
    const iov = (id: string) => arbol.resultados.flatMap((r: { indicadores: unknown[] }) => r.indicadores).find((i: { id: string }) => i.id === id);
    return {
      a: iov(ids.a),
      b: iov(ids.b),
      c: iov(ids.c),
      r1: res(ids.r1).cumplimientoPct as number,
      r2: res(ids.r2).cumplimientoPct as number,
      proyecto: arbol.proyecto.cumplimientoPct as number,
    };
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(StorageAdapter).useValue(new AlmacenamientoNulo()).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    ds = app.get(DataSource);

    tokens.admin = await login('admin@serfamilia.test');
    tokens.lucia = await login('tecnico@serfamilia.test');
    ids.lucia = (await ds.query(`SELECT id FROM usuarios WHERE email = 'tecnico@serfamilia.test'`))[0].id;

    const admin = (metodo: 'post' | 'patch', ruta: string, cuerpo: object) =>
      request(http())[metodo](`/api${ruta}`).set(bearer('admin')).send(cuerpo);
    ids.proyecto = (await admin('post', '/proyectos', { codigo, nombre: 'Proyecto de cumplimiento', fechaInicio: '2026-01-05', fechaFin: '2027-06-30' }).expect(201)).body.id;
    await admin('patch', `/proyectos/${ids.proyecto}/estado`, { estado: 'EN_EJECUCION' }).expect(200);
    await admin('post', `/proyectos/${ids.proyecto}/equipo`, { usuarioId: ids.lucia }).expect(201);

    const resultado = async (cod: string, peso: number) =>
      (await admin('post', `/proyectos/${ids.proyecto}/resultados`, { codigo: cod, descripcion: `Resultado ${cod}`, peso }).expect(201)).body.id as string;
    const indicador = async (resultadoId: string, cod: string, meta: number, peso: number) =>
      (await admin('post', `/proyectos/${ids.proyecto}/resultados/${resultadoId}/indicadores`, {
        codigo: cod, descripcion: `Indicador ${cod}`, unidad: 'familias', meta, peso, fuenteVerificacion: 'Acta', responsableId: ids.lucia,
      }).expect(201)).body.id as string;

    ids.r1 = await resultado('R.1', 60);
    ids.r2 = await resultado('R.2', 40);
    ids.a = await indicador(ids.r1, 'A', 130, 50);
    ids.b = await indicador(ids.r1, 'B', 10, 50);
    ids.c = await indicador(ids.r2, 'C', 20, 100);
  });

  afterAll(async () => {
    await borrarProyectosDePrueba(ds, 'CU-');
    await app.close();
  });

  it('al empezar todo está en 0 %', async () => {
    const e = await estado();
    expect([e.a.cumplimientoPct, e.b.cumplimientoPct, e.c.cumplimientoPct, e.r1, e.r2, e.proyecto]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('un avance enviado u observado no cambia el %', async () => {
    const id = await enviado(ids.a, 65);
    expect((await estado()).a.cumplimientoPct).toBe(0);
    await request(http()).patch(`${base()}/avances/${id}/observar`).set(bearer('admin')).send({ observacion: 'Falta la firma.' }).expect(200);
    const e = await estado();
    expect(e.a.cumplimientoPct).toBe(0);
    expect(e.a.valorActual).toBe(0);
    expect(e.proyecto).toBe(0);

    // la técnica corrige y reenvía; al aprobarse ya cuenta
    await request(http()).post(`${base()}/avances/${id}/enviar`).set(bearer('lucia')).expect(200);
    await aprobar(id);
  });

  it('CP-14: A con base 0, meta 130 y 65 aprobados queda al 50 %; R.1 al 25 % y el proyecto al 15 %', async () => {
    const e = await estado();
    expect(e.a.valorActual).toBe(65);
    expect(e.a.cumplimientoPct).toBe(50);
    expect(e.r1).toBe(25);
    expect(e.proyecto).toBe(15); // 25 × 60 % + 0 × 40 %
  });

  it('CP-14: con B al 100 % (peso 50), R.1 sube al 75 %', async () => {
    await aprobar(await enviado(ids.b, 10));
    const e = await estado();
    expect(e.b.cumplimientoPct).toBe(100);
    expect(e.r1).toBe(75);
    expect(e.proyecto).toBe(45); // 75 × 60 %
  });

  it('el proyecto pondera sus resultados por peso', async () => {
    await aprobar(await enviado(ids.c, 20));
    const e = await estado();
    expect(e.r2).toBe(100);
    expect(e.proyecto).toBe(85); // 75 × 60 % + 100 × 40 %
  });

  it('los avances aprobados se suman y el % no pasa de 100', async () => {
    await aprobar(await enviado(ids.a, 100));
    const e = await estado();
    expect(e.a.valorActual).toBe(165);
    expect(e.a.cumplimientoPct).toBe(100);
    expect(e.r1).toBe(100);
    expect(e.proyecto).toBe(100);
  });

  it('si el Administrador cambia la meta, el % se recalcula con lo ya aprobado', async () => {
    const r = await request(http()).patch(`${base()}/resultados/${ids.r1}/indicadores/${ids.a}`).set(bearer('admin')).send({ meta: 330 }).expect(200);
    expect(r.body.cumplimientoPct).toBe(50);
    const e = await estado();
    expect(e.r1).toBe(75);
    expect(e.proyecto).toBe(85);
  });

  it('si cambia el peso de un resultado, cambia el % del proyecto', async () => {
    await request(http()).patch(`${base()}/resultados/${ids.r1}`).set(bearer('admin')).send({ peso: 50 }).expect(200);
    await request(http()).patch(`${base()}/resultados/${ids.r2}`).set(bearer('admin')).send({ peso: 50 }).expect(200);
    expect((await estado()).proyecto).toBe(87.5); // 75 × 50 % + 100 × 50 %
  });
});