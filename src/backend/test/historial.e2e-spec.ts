import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { StorageAdapter } from '../src/infrastructure/storage/storage.adapter';
import { borrarProyectosDePrueba } from './helpers/limpieza';

/** Almacenamiento que no guarda nada: aquí solo importa el historial. */
class AlmacenamientoNulo extends StorageAdapter {
  async upload() {}
  async presignedDownloadUrl(key: string) {
    return `http://almacen.test/${key}`;
  }
  async remove() {}
  async ping() {}
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

interface Evento { tipo: string; detalle: string | null; usuario: { nombre: string } | null }
interface AvanceHistorial {
  id: string;
  estado: string;
  fechaCorte: string;
  revisadoPor: { nombre: string } | null;
  evidencias: { id: string }[];
  eventos: Evento[];
}

/** SGP-116: historial de avances, revisiones y evidencias por indicador y por actividad (CP-28). */
describe('Historial de avances (e2e, SGP-116)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const tokens = { admin: '', supervisor: '', ajeno: '', lucia: '', marco: '', rosa: '' };
  const ids = { proyecto: '', resultado: '', iov: '', actividad: '', lucia: '', marco: '', supervisor: '' };
  const avances = { aprobado: '', observado: '', enviado: '', borrador: '' };
  const codigo = `HI-${Date.now()}`.slice(0, 26);
  const http = () => app.getHttpServer();
  const bearer = (r: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[r]}` });
  const base = () => `/api/proyectos/${ids.proyecto}`;
  const login = async (email: string) =>
    (await request(http()).post('/api/auth/login').send({ email, password: 'Serfamilia2026' }).expect(200)).body.accessToken as string;
  const idDe = async (email: string) => (await ds.query(`SELECT id FROM usuarios WHERE email = $1`, [email]))[0].id as string;
  const historial = (quien: keyof typeof tokens, query: string) => request(http()).get(`${base()}/historial?${query}`).set(bearer(quien));

  /** La técnica registra un avance del indicador con su evidencia y lo envía. */
  const enviado = async (fechaCorte: string, valor: number, cuerpo: object = { iovId: ids.iov, valorReportado: valor }) => {
    const id = (await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ ...cuerpo, fechaCorte }).expect(201)).body.id as string;
    await request(http()).post(`${base()}/avances/${id}/evidencias`).set(bearer('lucia')).attach('archivo', PNG, 'acta.png').expect(201);
    await request(http()).post(`${base()}/avances/${id}/enviar`).set(bearer('lucia')).expect(200);
    return id;
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
    tokens.supervisor = await login('supervisor@serfamilia.test');
    tokens.ajeno = await login('gabriela.choque@serfamilia.test');
    tokens.lucia = await login('tecnico@serfamilia.test');
    tokens.marco = await login('marco.huanca@serfamilia.test');
    tokens.rosa = await login('rosa.mamani@serfamilia.test');
    ids.lucia = await idDe('tecnico@serfamilia.test');
    ids.marco = await idDe('marco.huanca@serfamilia.test');
    ids.supervisor = await idDe('supervisor@serfamilia.test');

    const admin = (metodo: 'post' | 'patch', ruta: string, cuerpo: object) =>
      request(http())[metodo](`/api${ruta}`).set(bearer('admin')).send(cuerpo);
    ids.proyecto = (await admin('post', '/proyectos', { codigo, nombre: 'Proyecto de historial', fechaInicio: '2026-01-05', fechaFin: '2027-06-30' }).expect(201)).body.id;
    await admin('patch', `/proyectos/${ids.proyecto}/estado`, { estado: 'EN_EJECUCION' }).expect(200);
    for (const usuarioId of [ids.lucia, ids.marco]) await admin('post', `/proyectos/${ids.proyecto}/equipo`, { usuarioId }).expect(201);
    await admin('post', `/proyectos/${ids.proyecto}/supervisores`, { usuarioId: ids.supervisor }).expect(201);
    ids.resultado = (await admin('post', `/proyectos/${ids.proyecto}/resultados`, { codigo: 'R.1', descripcion: 'Familias con huerto' }).expect(201)).body.id;
    ids.iov = (await admin('post', `/proyectos/${ids.proyecto}/resultados/${ids.resultado}/indicadores`, {
      codigo: 'I.O.V. 1.2', descripcion: 'Beneficiarios con huerto instalado', unidad: 'beneficiarios', meta: 130, fuenteVerificacion: 'Informe técnico', responsableId: ids.lucia,
    }).expect(201)).body.id;
    ids.actividad = (await admin('post', `/proyectos/${ids.proyecto}/resultados/${ids.resultado}/actividades`, {
      codigo: 'A.1.1', nombre: 'Instalación de huertos', tipoCronograma: 'CONTINUO', fechaInicio: '2026-02-01', fechaFin: '2027-05-31', responsableId: ids.lucia,
    }).expect(201)).body.id;

    // Se registran fuera de orden a propósito: el historial los ordena por fecha de corte.
    avances.enviado = await enviado('2026-09-01', 30);
    avances.aprobado = await enviado('2026-03-01', 20);
    avances.observado = await enviado('2026-06-01', 25);
    // El aprobado pasó antes por una observación
    await request(http()).patch(`${base()}/avances/${avances.aprobado}/observar`).set(bearer('admin')).send({ observacion: 'Falta la firma del dirigente.' }).expect(200);
    await request(http()).post(`${base()}/avances/${avances.aprobado}/enviar`).set(bearer('lucia')).expect(200);
    await request(http()).patch(`${base()}/avances/${avances.aprobado}/aprobar`).set(bearer('admin')).expect(200);
    await request(http()).patch(`${base()}/avances/${avances.observado}/observar`).set(bearer('admin')).send({ observacion: 'El acta no se lee.' }).expect(200);
    avances.borrador = (await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, valorReportado: 5, fechaCorte: '2026-10-01' }).expect(201)).body.id;
  });

  afterAll(async () => {
    await borrarProyectosDePrueba(ds, 'HI-');
    await app.close();
  });

  it('CP-28: un I.O.V. con 3 avances (uno observado) los lista en orden cronológico con estado, revisor y evidencia', async () => {
    const r = (await historial('supervisor', `iovId=${ids.iov}`).expect(200)).body;
    expect(r.objetivo).toEqual(expect.objectContaining({ tipo: 'IOV', codigo: 'I.O.V. 1.2', unidad: 'beneficiarios', meta: 130 }));

    const lista = r.avances as AvanceHistorial[];
    expect(lista.map((a) => a.id)).toEqual([avances.aprobado, avances.observado, avances.enviado]);
    expect(lista.map((a) => a.estado)).toEqual(['APROBADO', 'OBSERVADO', 'ENVIADO']);
    expect(lista.map((a) => a.fechaCorte)).toEqual(['2026-03-01', '2026-06-01', '2026-09-01']);
    expect(lista[0].revisadoPor?.nombre).toBeTruthy();
    expect(lista[1].revisadoPor?.nombre).toBeTruthy();
    expect(lista[2].revisadoPor).toBeNull();

    // cada evidencia tiene su enlace
    for (const a of lista) {
      expect(a.evidencias).toHaveLength(1);
      const enlace = (await request(http()).get(`${base()}/avances/${a.id}/evidencias/${a.evidencias[0].id}/descarga`).set(bearer('supervisor')).expect(200)).body;
      expect(enlace.url).toContain('almacen.test');
    }
  });

  it('la línea de tiempo conserva la observación aunque después lo aprueben', async () => {
    const [aprobado, observado] = (await historial('admin', `iovId=${ids.iov}`).expect(200)).body.avances as AvanceHistorial[];
    expect(aprobado.eventos.map((e) => e.tipo)).toEqual(['REGISTRADO', 'EVIDENCIA_ADJUNTADA', 'ENVIADO', 'OBSERVADO', 'REENVIADO', 'APROBADO']);
    const observacion = aprobado.eventos.find((e) => e.tipo === 'OBSERVADO')!;
    expect(observacion.detalle).toBe('Falta la firma del dirigente.');
    expect(observacion.usuario?.nombre).toBeTruthy();
    expect(observado.eventos.at(-1)).toEqual(expect.objectContaining({ tipo: 'OBSERVADO', detalle: 'El acta no se lee.' }));
  });

  it('el mismo historial está disponible para cada actividad', async () => {
    const id = await enviado('2026-04-15', 0, { actividadId: ids.actividad, descripcion: 'Huertos en la zona alta' });
    const r = (await historial('supervisor', `actividadId=${ids.actividad}`).expect(200)).body;
    expect(r.objetivo).toEqual(expect.objectContaining({ tipo: 'ACTIVIDAD', codigo: 'A.1.1' }));
    expect(r.avances.map((a: AvanceHistorial) => a.id)).toEqual([id]);
    expect(r.avances[0].eventos.map((e: Evento) => e.tipo)).toEqual(['REGISTRADO', 'EVIDENCIA_ADJUNTADA', 'ENVIADO']);
  });

  it('un indicador o actividad sin avances devuelve la lista vacía', async () => {
    const otro = (await request(http()).post(`${base()}/resultados/${ids.resultado}/indicadores`).set(bearer('admin')).send({
      codigo: 'I.O.V. 1.3', descripcion: 'Sin avances', unidad: 'familias', meta: 10, fuenteVerificacion: 'Acta',
    }).expect(201)).body.id;
    expect((await historial('admin', `iovId=${otro}`).expect(200)).body.avances).toEqual([]);
  });

  describe('Quién ve qué', () => {
    it('un técnico del proyecto ve los avances enviados de todo el equipo, no los borradores ajenos', async () => {
      const lista = (await historial('marco', `iovId=${ids.iov}`).expect(200)).body.avances as AvanceHistorial[];
      expect(lista.map((a) => a.id)).toEqual([avances.aprobado, avances.observado, avances.enviado]);
    });

    it('la autora ve también su propio borrador', async () => {
      const lista = (await historial('lucia', `iovId=${ids.iov}`).expect(200)).body.avances as AvanceHistorial[];
      expect(lista.map((a) => a.id)).toContain(avances.borrador);
      expect(lista).toHaveLength(4);
    });

    it('el Administrador y el Supervisor no ven borradores', async () => {
      for (const quien of ['admin', 'supervisor'] as const) {
        const lista = (await historial(quien, `iovId=${ids.iov}`).expect(200)).body.avances as AvanceHistorial[];
        expect(lista.some((a) => a.id === avances.borrador)).toBe(false);
      }
    });

    it('un técnico de otro proyecto y un supervisor que no lo supervisa reciben 403', async () => {
      await historial('rosa', `iovId=${ids.iov}`).expect(403);
      await historial('ajeno', `iovId=${ids.iov}`).expect(403);
    });
  });

  describe('Validaciones', () => {
    it('hace falta el indicador o la actividad, uno de los dos', async () => {
      await historial('admin', '').expect(400);
      await historial('admin', `iovId=${ids.iov}&actividadId=${ids.actividad}`).expect(400);
      await historial('admin', 'iovId=no-es-uuid').expect(400);
    });

    it('un indicador de otro proyecto se trata como inexistente (404)', async () => {
      const [{ id: ajeno }] = await ds.query(`SELECT i.id FROM iov i JOIN resultados r ON r.id = i.resultado_id WHERE r.proyecto_id <> $1 LIMIT 1`, [ids.proyecto]);
      await historial('admin', `iovId=${ajeno}`).expect(404);
    });
  });
});