import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { StorageAdapter } from '../src/infrastructure/storage/storage.adapter';
import { hoyIso } from '../src/modules/marco-logico/utils/estado-efectivo';
import { borrarProyectosDePrueba } from './helpers/limpieza';

/** Almacenamiento en memoria: la prueba no necesita MinIO, pero comprueba qué se sube y qué se borra. */
class AlmacenamientoEnMemoria extends StorageAdapter {
  readonly objetos = new Map<string, { contenido: Buffer; tipo: string }>();
  async upload(key: string, body: Buffer, contentType: string) {
    this.objetos.set(key, { contenido: body, tipo: contentType });
  }
  async presignedDownloadUrl(key: string) {
    return `http://almacen.test/${key}?firma=demo`;
  }
  async remove(key: string) {
    this.objetos.delete(key);
  }
  async ping() {}
}

const PDF_3MB = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(3 * 1024 * 1024, 0x20)]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

/** SGP-82: registro de avances con evidencia (CP-11, CP-12, tipos y tamaño admitidos, responsable). */
describe('Avances con evidencia (e2e, SGP-82)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const almacen = new AlmacenamientoEnMemoria();
  const tokens = { admin: '', supervisor: '', lucia: '', marco: '' };
  const ids = { proyecto: '', resultado: '', iov: '', actividad: '', actividadMarco: '', lucia: '', marco: '', supervisor: '' };
  const codigo = `AV-${Date.now()}`.slice(0, 26);
  const hoy = hoyIso();
  const http = () => app.getHttpServer();
  const bearer = (r: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[r]}` });
  const base = () => `/api/proyectos/${ids.proyecto}`;
  const login = async (email: string) =>
    (await request(http()).post('/api/auth/login').send({ email, password: 'Serfamilia2026' }).expect(200)).body.accessToken as string;
  const idDe = async (email: string) => (await ds.query(`SELECT id FROM usuarios WHERE email = $1`, [email]))[0].id as string;
  const subir = (avanceId: string, contenido: Buffer, nombre: string, quien: keyof typeof tokens = 'lucia') =>
    request(http()).post(`${base()}/avances/${avanceId}/evidencias`).set(bearer(quien)).attach('archivo', contenido, nombre);

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(StorageAdapter).useValue(almacen).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    ds = app.get(DataSource);

    tokens.admin = await login('admin@serfamilia.test');
    tokens.supervisor = await login('supervisor@serfamilia.test');
    tokens.lucia = await login('tecnico@serfamilia.test');
    tokens.marco = await login('marco.huanca@serfamilia.test');
    ids.lucia = await idDe('tecnico@serfamilia.test');
    ids.marco = await idDe('marco.huanca@serfamilia.test');
    ids.supervisor = await idDe('supervisor@serfamilia.test');

    const admin = (metodo: 'post' | 'patch', ruta: string, cuerpo: object) =>
      request(http())[metodo](`/api${ruta}`).set(bearer('admin')).send(cuerpo);
    ids.proyecto = (await admin('post', '/proyectos', { codigo, nombre: 'Proyecto de avances', fechaInicio: '2026-01-05', fechaFin: '2027-06-30' }).expect(201)).body.id;
    await admin('patch', `/proyectos/${ids.proyecto}/estado`, { estado: 'EN_EJECUCION' }).expect(200);
    for (const usuarioId of [ids.lucia, ids.marco]) await admin('post', `/proyectos/${ids.proyecto}/equipo`, { usuarioId }).expect(201);
    await admin('post', `/proyectos/${ids.proyecto}/supervisores`, { usuarioId: ids.supervisor }).expect(201);
    ids.resultado = (await admin('post', `/proyectos/${ids.proyecto}/resultados`, { codigo: 'R.1', descripcion: 'Familias con huerto' }).expect(201)).body.id;
    ids.iov = (await admin('post', `/proyectos/${ids.proyecto}/resultados/${ids.resultado}/indicadores`, {
      codigo: 'I.O.V. 1.2', descripcion: 'Beneficiarios con huerto instalado', unidad: 'beneficiarios', meta: 130, fuenteVerificacion: 'Informe técnico', responsableId: ids.lucia,
    }).expect(201)).body.id;
    const actividad = async (cod: string, responsableId: string) =>
      (await admin('post', `/proyectos/${ids.proyecto}/resultados/${ids.resultado}/actividades`, {
        codigo: cod, nombre: `Actividad ${cod}`, tipoCronograma: 'CONTINUO', fechaInicio: '2026-02-01', fechaFin: '2027-05-31', responsableId,
      }).expect(201)).body.id as string;
    ids.actividad = await actividad('A.1.1', ids.lucia);
    ids.actividadMarco = await actividad('A.1.2', ids.marco);
  });

  afterAll(async () => {
    await borrarProyectosDePrueba(ds, 'AV-');
    await app.close();
  });

  describe('CP-11: registrar un avance', () => {
    let avanceId = '';

    it('la técnica responsable de I.O.V. 1.2 registra 40 beneficiarios con su fecha de corte: queda en Borrador', async () => {
      const r = (await request(http()).post(`${base()}/avances`).set(bearer('lucia'))
        .send({ iovId: ids.iov, valorReportado: 40, fechaCorte: hoy, descripcion: 'Huertos instalados en la zona alta' }).expect(201)).body;
      avanceId = r.id;
      expect(r).toMatchObject({
        estado: 'BORRADOR', valorReportado: 40, fechaCorte: hoy, evidencias: [],
        objetivo: { tipo: 'IOV', codigo: 'I.O.V. 1.2', unidad: 'beneficiarios' },
      });
    });

    it('el borrador lo ve su autora; el Administrador y el Supervisor todavía no', async () => {
      expect((await request(http()).get(`${base()}/avances`).set(bearer('lucia')).expect(200)).body.map((a: { id: string }) => a.id)).toContain(avanceId);
      expect((await request(http()).get(`${base()}/avances`).set(bearer('admin')).expect(200)).body).toEqual([]);
      expect((await request(http()).get(`${base()}/avances`).set(bearer('supervisor')).expect(200)).body).toEqual([]);
    });

    it('lo puede corregir mientras es borrador', async () => {
      const r = (await request(http()).patch(`${base()}/avances/${avanceId}`).set(bearer('lucia')).send({ valorReportado: 42 }).expect(200)).body;
      expect(r.valorReportado).toBe(42);
    });

    it('un avance de indicador necesita su valor; uno de actividad, no', async () => {
      await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, fechaCorte: hoy }).expect(400);
      const r = (await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ actividadId: ids.actividad, fechaCorte: hoy }).expect(201)).body;
      expect(r).toMatchObject({ estado: 'BORRADOR', valorReportado: null, objetivo: { tipo: 'ACTIVIDAD', codigo: 'A.1.1' } });
    });

    it('va a un indicador o a una actividad, nunca a los dos ni a ninguno', async () => {
      await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, actividadId: ids.actividad, valorReportado: 1, fechaCorte: hoy }).expect(400);
      await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ fechaCorte: hoy }).expect(400);
    });

    it('la fecha de corte no puede ser futura ni anterior al inicio del proyecto', async () => {
      const [{ manana }] = await ds.query(`SELECT to_char(CURRENT_DATE + 1, 'YYYY-MM-DD') AS manana`);
      await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, valorReportado: 1, fechaCorte: manana }).expect(422);
      await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, valorReportado: 1, fechaCorte: '2025-12-31' }).expect(422);
      await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, valorReportado: -3, fechaCorte: hoy }).expect(400);
    });
  });

  describe('Solo el técnico responsable registra avances (RN-10)', () => {
    it('Marco, del mismo equipo pero no responsable del indicador ni de A.1.1, recibe 403', async () => {
      const r = await request(http()).post(`${base()}/avances`).set(bearer('marco')).send({ iovId: ids.iov, valorReportado: 5, fechaCorte: hoy }).expect(403);
      expect(r.body.detail).toContain('Solo el técnico responsable del indicador');
      await request(http()).post(`${base()}/avances`).set(bearer('marco')).send({ actividadId: ids.actividad, fechaCorte: hoy }).expect(403);
    });

    it('Marco sí registra los avances de su propia actividad', async () => {
      await request(http()).post(`${base()}/avances`).set(bearer('marco')).send({ actividadId: ids.actividadMarco, fechaCorte: hoy }).expect(201);
    });

    it('el Administrador y el Supervisor no registran avances: los revisan', async () => {
      await request(http()).post(`${base()}/avances`).set(bearer('admin')).send({ iovId: ids.iov, valorReportado: 5, fechaCorte: hoy }).expect(403);
      await request(http()).post(`${base()}/avances`).set(bearer('supervisor')).send({ iovId: ids.iov, valorReportado: 5, fechaCorte: hoy }).expect(403);
    });

    it('un indicador de otro proyecto se trata como inexistente (404)', async () => {
      const [{ id: ajeno }] = await ds.query(`SELECT i.id FROM iov i JOIN resultados r ON r.id = i.resultado_id WHERE r.proyecto_id <> $1 LIMIT 1`, [ids.proyecto]);
      await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ajeno, valorReportado: 1, fechaCorte: hoy }).expect(404);
    });

    it('nadie más puede tocar el borrador de otro: para ellos no existe', async () => {
      const [mio] = (await request(http()).get(`${base()}/avances?iovId=${ids.iov}`).set(bearer('lucia')).expect(200)).body;
      await request(http()).patch(`${base()}/avances/${mio.id}`).set(bearer('marco')).send({ valorReportado: 99 }).expect(404);
      await subir(mio.id, PDF_3MB, 'ajeno.pdf', 'marco').expect(404);
    });
  });

  describe('Evidencias: tipo y tamaño admitidos (RN-04)', () => {
    let avanceId = '';
    beforeAll(async () => {
      avanceId = (await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, valorReportado: 12, fechaCorte: hoy }).expect(201)).body.id;
    });

    it('acepta un PDF de 3 MB: lo guarda en el almacenamiento con un nombre propio y registra su huella', async () => {
      const r = (await subir(avanceId, PDF_3MB, 'Acta de entrega.pdf').expect(201)).body;
      expect(r).toMatchObject({ nombreOriginal: 'Acta de entrega.pdf', mime: 'application/pdf', tamanoBytes: PDF_3MB.length, version: 1 });
      expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
      const [{ storage_key }] = await ds.query(`SELECT storage_key FROM evidencias WHERE id = $1`, [r.id]);
      expect(storage_key).toMatch(new RegExp(`^avances/${avanceId}/[0-9a-f-]{36}\\.pdf$`));
      expect(almacen.objetos.get(storage_key)?.contenido.length).toBe(PDF_3MB.length);
    });

    it('acepta una foto PNG', async () => {
      expect((await subir(avanceId, PNG, 'foto.png').expect(201)).body.mime).toBe('image/png');
    });

    it('rechaza un tipo no admitido con un mensaje claro, aunque se llame .pdf', async () => {
      const r = await subir(avanceId, Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), 'informe.pdf').expect(422);
      expect(r.body.detail).toContain('Solo se aceptan PDF, JPG, PNG, WEBP');
    });

    it('rechaza un archivo de más de 25 MB con un mensaje claro', async () => {
      const grande = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(25 * 1024 * 1024 + 1)]);
      const r = await subir(avanceId, grande, 'enorme.pdf').expect(413);
      expect(r.body.detail).toBe('El archivo supera el máximo de 25 MB.');
    });

    it('sin archivo responde 422', async () => {
      await request(http()).post(`${base()}/avances/${avanceId}/evidencias`).set(bearer('lucia')).expect(422);
    });

    it('en borrador se puede quitar una evidencia equivocada; se borra también del almacenamiento', async () => {
      const r = (await subir(avanceId, PNG, 'equivocada.png').expect(201)).body;
      const [{ storage_key }] = await ds.query(`SELECT storage_key FROM evidencias WHERE id = $1`, [r.id]);
      await request(http()).delete(`${base()}/avances/${avanceId}/evidencias/${r.id}`).set(bearer('lucia')).expect(204);
      expect(almacen.objetos.has(storage_key)).toBe(false);
    });

    it('la descarga entrega un enlace temporal', async () => {
      const [ev] = (await request(http()).get(`${base()}/avances?iovId=${ids.iov}`).set(bearer('lucia')).expect(200)).body.find((a: { id: string }) => a.id === avanceId).evidencias;
      const r = (await request(http()).get(`${base()}/avances/${avanceId}/evidencias/${ev.id}/descarga`).set(bearer('lucia')).expect(200)).body;
      expect(r).toMatchObject({ nombre: 'Acta de entrega.pdf', venceEnSegundos: 300 });
      expect(r.url).toContain('http://almacen.test/avances/');
    });
  });

  describe('CP-12: no se envía a revisión sin evidencia', () => {
    it('sin archivo adjunto el envío se bloquea; con un PDF de 3 MB se permite', async () => {
      const id = (await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, valorReportado: 40, fechaCorte: hoy }).expect(201)).body.id;

      const bloqueado = await request(http()).post(`${base()}/avances/${id}/enviar`).set(bearer('lucia')).expect(422);
      expect(bloqueado.body.detail).toContain('Adjunta al menos una evidencia');

      await subir(id, PDF_3MB, 'acta.pdf').expect(201);
      const r = (await request(http()).post(`${base()}/avances/${id}/enviar`).set(bearer('lucia')).expect(200)).body;
      expect(r.estado).toBe('ENVIADO');
      expect(r.enviadoAt).not.toBeNull();
    });

    it('una vez enviado ya no se corrige ni se le quitan o agregan evidencias', async () => {
      const [enviado] = (await request(http()).get(`${base()}/avances?iovId=${ids.iov}`).set(bearer('lucia')).expect(200)).body.filter((a: { estado: string }) => a.estado === 'ENVIADO');
      await request(http()).patch(`${base()}/avances/${enviado.id}`).set(bearer('lucia')).send({ valorReportado: 1 }).expect(422);
      await request(http()).delete(`${base()}/avances/${enviado.id}/evidencias/${enviado.evidencias[0].id}`).set(bearer('lucia')).expect(422);
      await subir(enviado.id, PNG, 'tarde.png').expect(422);
      await request(http()).delete(`${base()}/avances/${enviado.id}`).set(bearer('lucia')).expect(422);
    });

    it('el enviado ya lo ven el Administrador y el Supervisor, con su evidencia', async () => {
      for (const quien of ['admin', 'supervisor'] as const) {
        const lista = (await request(http()).get(`${base()}/avances`).set(bearer(quien)).expect(200)).body as { estado: string; evidencias: unknown[] }[];
        expect(lista.length).toBeGreaterThanOrEqual(1);
        expect(lista.every((a) => a.estado !== 'BORRADOR')).toBe(true);
        expect(lista[0].evidencias).toHaveLength(1);
      }
    });
  });

  describe('Borradores y proyectos cerrados', () => {
    it('un borrador se elimina con sus evidencias', async () => {
      const id = (await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, valorReportado: 3, fechaCorte: hoy }).expect(201)).body.id;
      await subir(id, PNG, 'foto.png').expect(201);
      const antes = almacen.objetos.size;
      await request(http()).delete(`${base()}/avances/${id}`).set(bearer('lucia')).expect(204);
      expect(almacen.objetos.size).toBe(antes - 1);
      expect((await ds.query(`SELECT COUNT(*)::int AS n FROM avances WHERE id = $1`, [id]))[0].n).toBe(0);
    });

    it('un técnico de otro proyecto no entra (403)', async () => {
      await ds.query(`DELETE FROM proyecto_equipo WHERE proyecto_id = $1 AND usuario_id = $2`, [ids.proyecto, ids.marco]);
      await request(http()).get(`${base()}/avances`).set(bearer('marco')).expect(403);
    });

    it('un proyecto cerrado no admite avances nuevos', async () => {
      await request(http()).patch(`${base()}/estado`).set(bearer('admin')).send({ estado: 'CERRADO' }).expect(200);
      const r = await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, valorReportado: 1, fechaCorte: hoy }).expect(422);
      expect(r.body.detail).toContain('cerrado');
    });
  });
});