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

  describe('SGP-94: el Administrador aprueba u observa', () => {
    const enviado = async (valor = 10) => {
      const id = (await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, valorReportado: valor, fechaCorte: hoy }).expect(201)).body.id as string;
      await subir(id, PNG, 'acta.png').expect(201);
      await request(http()).post(`${base()}/avances/${id}/enviar`).set(bearer('lucia')).expect(200);
      return id;
    };

    it('CP-27: observar sin comentario se rechaza; con comentario queda Observado y vuelve a la técnica', async () => {
      const id = await enviado();
      const sin = await request(http()).patch(`${base()}/avances/${id}/observar`).set(bearer('admin')).send({ observacion: '   ' }).expect(400);
      expect(JSON.stringify(sin.body)).toContain('observación');
      await request(http()).patch(`${base()}/avances/${id}/observar`).set(bearer('admin')).send({}).expect(400);

      const r = (await request(http()).patch(`${base()}/avances/${id}/observar`).set(bearer('admin')).send({ observacion: 'El acta no tiene firmas.' }).expect(200)).body;
      expect(r.estado).toBe('OBSERVADO');
      expect(r.observacion).toBe('El acta no tiene firmas.');
      expect(r.revisadoPor.id).toBeTruthy();
      expect(r.revisadoAt).toBeTruthy();

      const suya = (await request(http()).get(`${base()}/avances?iovId=${ids.iov}`).set(bearer('lucia')).expect(200)).body.find((a: { id: string }) => a.id === id);
      expect(suya.estado).toBe('OBSERVADO');
      expect(suya.observacion).toBe('El acta no tiene firmas.');
    });

    it('Observado → la técnica corrige, adjunta y reenvía; el Administrador lo aprueba', async () => {
      const id = await enviado();
      await request(http()).patch(`${base()}/avances/${id}/observar`).set(bearer('admin')).send({ observacion: 'Falta la foto.' }).expect(200);
      await request(http()).patch(`${base()}/avances/${id}`).set(bearer('lucia')).send({ valorReportado: 12 }).expect(200);
      await subir(id, PNG, 'foto.png').expect(201);
      expect((await request(http()).post(`${base()}/avances/${id}/enviar`).set(bearer('lucia')).expect(200)).body.estado).toBe('ENVIADO');

      const r = (await request(http()).patch(`${base()}/avances/${id}/aprobar`).set(bearer('admin')).expect(200)).body;
      expect(r.estado).toBe('APROBADO');
      expect(r.valorReportado).toBe(12);
    });

    it('un aprobado ya no se revisa de nuevo ni se corrige', async () => {
      const id = await enviado();
      await request(http()).patch(`${base()}/avances/${id}/aprobar`).set(bearer('admin')).expect(200);
      await request(http()).patch(`${base()}/avances/${id}/aprobar`).set(bearer('admin')).expect(422);
      await request(http()).patch(`${base()}/avances/${id}/observar`).set(bearer('admin')).send({ observacion: 'tarde' }).expect(422);
      await request(http()).patch(`${base()}/avances/${id}`).set(bearer('lucia')).send({ valorReportado: 99 }).expect(422);
    });

    it('un borrador no se revisa: para el Administrador no existe', async () => {
      const id = (await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, valorReportado: 1, fechaCorte: hoy }).expect(201)).body.id;
      await request(http()).patch(`${base()}/avances/${id}/aprobar`).set(bearer('admin')).expect(404);
      await request(http()).delete(`${base()}/avances/${id}`).set(bearer('lucia')).expect(204);
    });

    it('SGP-96: la bandeja del Administrador junta los enviados, del más antiguo al más reciente', async () => {
      const primero = await enviado(7);
      const segundo = await enviado(8);
      const bandeja = (await request(http()).get('/api/avances/revision').set(bearer('admin')).expect(200)).body as Array<{ id: string; estado: string; proyecto: { id: string; codigo: string }; evidencias: unknown[] }>;
      expect(bandeja.every((a) => a.estado === 'ENVIADO')).toBe(true);
      const ids_ = bandeja.map((a) => a.id);
      expect(ids_.indexOf(primero)).toBeLessThan(ids_.indexOf(segundo));
      const item = bandeja.find((a) => a.id === primero)!;
      expect(item.proyecto).toEqual(expect.objectContaining({ id: ids.proyecto, codigo }));
      expect(item.evidencias).toHaveLength(1);

      await request(http()).patch(`${base()}/avances/${primero}/aprobar`).set(bearer('admin')).expect(200);
      const despues = (await request(http()).get('/api/avances/revision').set(bearer('admin')).expect(200)).body as Array<{ id: string }>;
      expect(despues.some((a) => a.id === primero)).toBe(false);
      expect(despues.some((a) => a.id === segundo)).toBe(true);
    });

    it('SGP-96: la bandeja es solo del Administrador', async () => {
      await request(http()).get('/api/avances/revision').set(bearer('supervisor')).expect(403);
      await request(http()).get('/api/avances/revision').set(bearer('lucia')).expect(403);
    });

    it('CP-18: la técnica y el Supervisor no aprueban ni observan (403)', async () => {
      const id = await enviado();
      for (const quien of ['lucia', 'supervisor'] as const) {
        await request(http()).patch(`${base()}/avances/${id}/aprobar`).set(bearer(quien)).expect(403);
        await request(http()).patch(`${base()}/avances/${id}/observar`).set(bearer(quien)).send({ observacion: 'x' }).expect(403);
      }
      const sigue = (await request(http()).get(`${base()}/avances`).set(bearer('admin')).expect(200)).body.find((a: { id: string }) => a.id === id);
      expect(sigue.estado).toBe('ENVIADO');
    });
  });

  describe('SGP-134: las evidencias de un avance enviado no se borran ni se modifican (RN-08)', () => {
    /** Avance de la técnica con una evidencia; si `enviar`, lo manda a revisión. */
    const conEvidencia = async (enviar = true) => {
      const id = (await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, valorReportado: 5, fechaCorte: hoy }).expect(201)).body.id as string;
      const evidencia = (await subir(id, PNG, 'acta.png').expect(201)).body.id as string;
      if (enviar) await request(http()).post(`${base()}/avances/${id}/enviar`).set(bearer('lucia')).expect(200);
      const [{ storage_key }] = await ds.query(`SELECT storage_key FROM evidencias WHERE id = $1`, [evidencia]);
      return { id, evidencia, storageKey: storage_key as string };
    };
    const borrarEvidencia = (avanceId: string, evidenciaId: string, quien: keyof typeof tokens = 'lucia') =>
      request(http()).delete(`${base()}/avances/${avanceId}/evidencias/${evidenciaId}`).set(bearer(quien));

    it('enviado: la técnica no puede borrar su evidencia, agregar otra ni eliminar el avance; el archivo sigue ahí', async () => {
      const a = await conEvidencia();
      await borrarEvidencia(a.id, a.evidencia).expect(422);
      await subir(a.id, PNG, 'otra.png').expect(422);
      await request(http()).delete(`${base()}/avances/${a.id}`).set(bearer('lucia')).expect(422);

      expect(almacen.objetos.has(a.storageKey)).toBe(true);
      expect((await ds.query(`SELECT COUNT(*)::int AS n FROM evidencias WHERE avance_id = $1`, [a.id]))[0].n).toBe(1);
    });

    it('observado: lo ya enviado queda intacto; solo se agregan evidencias nuevas para corregir', async () => {
      const a = await conEvidencia();
      await request(http()).patch(`${base()}/avances/${a.id}/observar`).set(bearer('admin')).send({ observacion: 'La foto no se lee.' }).expect(200);

      const r = await borrarEvidencia(a.id, a.evidencia).expect(422);
      expect(r.body.detail).toContain('no se pueden borrar ni modificar');
      await subir(a.id, PNG, 'foto-nitida.png').expect(201);

      const [avance] = (await request(http()).get(`${base()}/avances?iovId=${ids.iov}`).set(bearer('lucia')).expect(200)).body.filter((x: { id: string }) => x.id === a.id);
      expect(avance.evidencias.map((e: { nombreOriginal: string }) => e.nombreOriginal)).toEqual(['acta.png', 'foto-nitida.png']);
      expect(almacen.objetos.has(a.storageKey)).toBe(true);
    });

    it('aprobado: ya no admite ningún cambio en sus evidencias', async () => {
      const a = await conEvidencia();
      await request(http()).patch(`${base()}/avances/${a.id}/aprobar`).set(bearer('admin')).expect(200);
      await borrarEvidencia(a.id, a.evidencia).expect(422);
      await subir(a.id, PNG, 'tarde.png').expect(422);
      expect(almacen.objetos.has(a.storageKey)).toBe(true);
    });

    it('el Administrador y el Supervisor tampoco borran evidencias (403)', async () => {
      const a = await conEvidencia();
      await borrarEvidencia(a.id, a.evidencia, 'admin').expect(403);
      await borrarEvidencia(a.id, a.evidencia, 'supervisor').expect(403);
    });

    it('la base de datos lo impide aunque alguien se salte la API', async () => {
      const enviado = await conEvidencia();
      const borrador = await conEvidencia(false);

      // Modificar: nunca, ni siquiera en un borrador
      await expect(ds.query(`UPDATE evidencias SET nombre_original = 'otro.png' WHERE id = $1`, [enviado.evidencia])).rejects.toThrow('no se pueden modificar');
      await expect(ds.query(`UPDATE evidencias SET sha256 = repeat('0', 64) WHERE id = $1`, [borrador.evidencia])).rejects.toThrow('no se pueden modificar');
      // Borrar la evidencia o el avance enviado
      await expect(ds.query(`DELETE FROM evidencias WHERE id = $1`, [enviado.evidencia])).rejects.toThrow('no se pueden borrar');
      await expect(ds.query(`DELETE FROM avances WHERE id = $1`, [enviado.id])).rejects.toThrow('Solo se puede eliminar un avance en borrador');
      // Agregar a un avance enviado
      await expect(
        ds.query(
          `INSERT INTO evidencias (avance_id, storage_key, nombre_original, mime, tamano_bytes, sha256, subido_por)
           VALUES ($1, $2, 'colada.pdf', 'application/pdf', 10, repeat('a', 64), $3)`,
          [enviado.id, `avances/${enviado.id}/colada.pdf`, ids.lucia],
        ),
      ).rejects.toThrow('borrador u observado');

      // El borrador sí se puede limpiar por la API
      await request(http()).delete(`${base()}/avances/${borrador.id}`).set(bearer('lucia')).expect(204);
    });
  });

  describe('SGP-135: el Administrador anula una evidencia con motivo (CP-19)', () => {
    const conEvidencia = async () => {
      const id = (await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, valorReportado: 4, fechaCorte: hoy }).expect(201)).body.id as string;
      const evidencia = (await subir(id, PNG, 'acta.png').expect(201)).body.id as string;
      await request(http()).post(`${base()}/avances/${id}/enviar`).set(bearer('lucia')).expect(200);
      return { id, evidencia };
    };
    const anular = (avanceId: string, evidenciaId: string, cuerpo: object, quien: keyof typeof tokens = 'admin') =>
      request(http()).patch(`${base()}/avances/${avanceId}/evidencias/${evidenciaId}/anular`).set(bearer(quien)).send(cuerpo);

    it('CP-19: queda Anulada con su motivo, el archivo original se conserva y la acción queda en la bitácora', async () => {
      const a = await conEvidencia();
      const [{ storage_key }] = await ds.query(`SELECT storage_key FROM evidencias WHERE id = $1`, [a.evidencia]);

      const r = (await anular(a.id, a.evidencia, { motivo: 'La foto corresponde a otra comunidad.' }).expect(200)).body;
      expect(r.anulacion).toEqual(expect.objectContaining({ motivo: 'La foto corresponde a otra comunidad.', por: expect.objectContaining({ nombre: expect.any(String) }) }));

      // el archivo sigue en el almacenamiento y se puede abrir
      expect(almacen.objetos.has(storage_key)).toBe(true);
      await request(http()).get(`${base()}/avances/${a.id}/evidencias/${a.evidencia}/descarga`).set(bearer('supervisor')).expect(200);
      // la técnica la ve anulada en su avance
      const [avance] = (await request(http()).get(`${base()}/avances?iovId=${ids.iov}`).set(bearer('lucia')).expect(200)).body.filter((x: { id: string }) => x.id === a.id);
      expect(avance.evidencias[0].anulacion.motivo).toBe('La foto corresponde a otra comunidad.');

      const bitacora = await ds.query(
        `SELECT accion, usuario_id, proyecto_id, valor_nuevo FROM audit_log WHERE entidad = 'evidencias' AND entidad_id = $1 ORDER BY id`,
        [a.evidencia],
      );
      const anulacion = bitacora.find((b: { accion: string }) => b.accion === 'ANULAR');
      expect(anulacion).toBeDefined();
      expect(anulacion.proyecto_id).toBe(ids.proyecto);
      expect(anulacion.valor_nuevo.motivo_anulacion).toBe('La foto corresponde a otra comunidad.');
      const [{ id: adminId }] = await ds.query(`SELECT id FROM usuarios WHERE email = 'admin@serfamilia.test'`);
      expect(anulacion.usuario_id).toBe(adminId);
      // y no se anotó además como una modificación genérica
      expect(bitacora.some((b: { accion: string }) => b.accion === 'ACTUALIZAR')).toBe(false);
    });

    it('sin motivo, o con uno que no explica nada, se rechaza', async () => {
      const a = await conEvidencia();
      await anular(a.id, a.evidencia, {}).expect(400);
      await anular(a.id, a.evidencia, { motivo: '   ' }).expect(400);
      await anular(a.id, a.evidencia, { motivo: 'mal' }).expect(400);
    });

    it('solo el Administrador anula: la técnica y el Supervisor reciben 403', async () => {
      const a = await conEvidencia();
      await anular(a.id, a.evidencia, { motivo: 'No corresponde.' }, 'lucia').expect(403);
      await anular(a.id, a.evidencia, { motivo: 'No corresponde.' }, 'supervisor').expect(403);
    });

    it('una evidencia anulada no se anula dos veces', async () => {
      const a = await conEvidencia();
      await anular(a.id, a.evidencia, { motivo: 'Documento ilegible.' }).expect(200);
      await anular(a.id, a.evidencia, { motivo: 'Otra vez.' }).expect(409);
    });

    it('sin evidencias válidas no se aprueba; la técnica adjunta una nueva, reenvía y recién se aprueba', async () => {
      const a = await conEvidencia();
      await anular(a.id, a.evidencia, { motivo: 'Documento ilegible.' }).expect(200);
      const r = await request(http()).patch(`${base()}/avances/${a.id}/aprobar`).set(bearer('admin')).expect(422);
      expect(r.body.detail).toContain('anuladas');

      await request(http()).patch(`${base()}/avances/${a.id}/observar`).set(bearer('admin')).send({ observacion: 'Sube un acta legible.' }).expect(200);
      const sinValida = await request(http()).post(`${base()}/avances/${a.id}/enviar`).set(bearer('lucia')).expect(422);
      expect(sinValida.body.detail).toContain('anuladas');
      await subir(a.id, PNG, 'acta-legible.png').expect(201);
      await request(http()).post(`${base()}/avances/${a.id}/enviar`).set(bearer('lucia')).expect(200);
      await request(http()).patch(`${base()}/avances/${a.id}/aprobar`).set(bearer('admin')).expect(200);
    });

    it('la base solo admite anular una vez, sin tocar nada más, y nunca en un borrador', async () => {
      const a = await conEvidencia();
      const [{ id: adminId }] = await ds.query(`SELECT id FROM usuarios WHERE email = 'admin@serfamilia.test'`);
      // anular y de paso cambiar el nombre: no
      await expect(
        ds.query(`UPDATE evidencias SET anulada_at = now(), anulada_por = $2, motivo_anulacion = 'x', nombre_original = 'otro.png' WHERE id = $1`, [a.evidencia, adminId]),
      ).rejects.toThrow('no se pueden modificar');
      // anular sin motivo: no
      await expect(ds.query(`UPDATE evidencias SET anulada_at = now(), anulada_por = $2 WHERE id = $1`, [a.evidencia, adminId])).rejects.toThrow('ck_evidencia_anulacion');

      await anular(a.id, a.evidencia, { motivo: 'Documento ilegible.' }).expect(200);
      await expect(ds.query(`UPDATE evidencias SET motivo_anulacion = 'otro motivo' WHERE id = $1`, [a.evidencia])).rejects.toThrow('ya está anulada');

      // en un borrador no se anula: se quita
      const borrador = (await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, valorReportado: 1, fechaCorte: hoy }).expect(201)).body.id as string;
      const ev = (await subir(borrador, PNG, 'b.png').expect(201)).body.id as string;
      await expect(
        ds.query(`UPDATE evidencias SET anulada_at = now(), anulada_por = $2, motivo_anulacion = 'x' WHERE id = $1`, [ev, adminId]),
      ).rejects.toThrow('no se pueden modificar');
      await anular(borrador, ev, { motivo: 'No corresponde.' }).expect(404);
      await request(http()).delete(`${base()}/avances/${borrador}`).set(bearer('lucia')).expect(204);
    });
  });

  describe('SGP-136: para corregir una evidencia se sube una nueva versión; la anterior queda en el historial', () => {
    const PNG2 = Buffer.concat([PNG, Buffer.from('v2')]);
    /** Avance enviado con una evidencia y luego observado. */
    const observado = async () => {
      const id = (await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, valorReportado: 6, fechaCorte: hoy }).expect(201)).body.id as string;
      const evidencia = (await subir(id, PNG, 'acta.png').expect(201)).body.id as string;
      await request(http()).post(`${base()}/avances/${id}/enviar`).set(bearer('lucia')).expect(200);
      await request(http()).patch(`${base()}/avances/${id}/observar`).set(bearer('admin')).send({ observacion: 'El acta no se lee.' }).expect(200);
      return { id, evidencia };
    };
    const version = (avanceId: string, evidenciaId: string, contenido: Buffer, nombre: string, quien: keyof typeof tokens = 'lucia') =>
      request(http()).post(`${base()}/avances/${avanceId}/evidencias/${evidenciaId}/versiones`).set(bearer(quien)).attach('archivo', contenido, nombre);
    const delAvance = async (avanceId: string) =>
      (await request(http()).get(`${base()}/avances?iovId=${ids.iov}`).set(bearer('lucia')).expect(200)).body.find((x: { id: string }) => x.id === avanceId);

    it('la técnica sube la versión 2; la 1 sigue visible como reemplazada, con su archivo', async () => {
      const a = await observado();
      const [{ storage_key: claveV1 }] = await ds.query(`SELECT storage_key FROM evidencias WHERE id = $1`, [a.evidencia]);

      const v2 = (await version(a.id, a.evidencia, PNG2, 'acta-legible.png').expect(201)).body;
      expect(v2).toEqual(expect.objectContaining({ version: 2, reemplazaA: a.evidencia, vigente: true, nombreOriginal: 'acta-legible.png' }));

      const avance = await delAvance(a.id);
      expect(avance.evidencias).toHaveLength(2);
      const v1 = avance.evidencias.find((e: { id: string }) => e.id === a.evidencia);
      expect(v1).toEqual(expect.objectContaining({ version: 1, vigente: false }));
      expect(almacen.objetos.has(claveV1)).toBe(true);
      // la versión anterior se sigue pudiendo abrir
      await request(http()).get(`${base()}/avances/${a.id}/evidencias/${a.evidencia}/descarga`).set(bearer('admin')).expect(200);

      await request(http()).post(`${base()}/avances/${a.id}/enviar`).set(bearer('lucia')).expect(200);
      await request(http()).patch(`${base()}/avances/${a.id}/aprobar`).set(bearer('admin')).expect(200);
    });

    it('una evidencia anulada se corrige con una nueva versión; la anulada queda en el historial', async () => {
      const a = await observado();
      await request(http()).patch(`${base()}/avances/${a.id}/evidencias/${a.evidencia}/anular`).set(bearer('admin')).send({ motivo: 'Documento ilegible.' }).expect(200);
      await request(http()).post(`${base()}/avances/${a.id}/enviar`).set(bearer('lucia')).expect(422);

      await version(a.id, a.evidencia, PNG2, 'acta-legible.png').expect(201);
      const v1 = (await delAvance(a.id)).evidencias.find((e: { id: string }) => e.id === a.evidencia);
      expect(v1.anulacion.motivo).toBe('Documento ilegible.');
      expect(v1.vigente).toBe(false);
      await request(http()).post(`${base()}/avances/${a.id}/enviar`).set(bearer('lucia')).expect(200);
    });

    it('si la versión nueva se anula, la anterior no vuelve a valer: hace falta otra versión', async () => {
      const a = await observado();
      const v2 = (await version(a.id, a.evidencia, PNG2, 'v2.png').expect(201)).body.id as string;
      await request(http()).post(`${base()}/avances/${a.id}/enviar`).set(bearer('lucia')).expect(200);
      await request(http()).patch(`${base()}/avances/${a.id}/evidencias/${v2}/anular`).set(bearer('admin')).send({ motivo: 'Tampoco se lee.' }).expect(200);
      await request(http()).patch(`${base()}/avances/${a.id}/aprobar`).set(bearer('admin')).expect(422);
      await request(http()).patch(`${base()}/avances/${a.id}/observar`).set(bearer('admin')).send({ observacion: 'Sube otra versión.' }).expect(200);
      const v3 = (await version(a.id, v2, Buffer.concat([PNG, Buffer.from('v3')]), 'v3.png').expect(201)).body;
      expect(v3.version).toBe(3);
    });

    it('solo se corrige la versión vigente, y una sola vez', async () => {
      const a = await observado();
      await version(a.id, a.evidencia, PNG2, 'v2.png').expect(201);
      const r = await version(a.id, a.evidencia, PNG2, 'otra-v2.png').expect(409);
      expect(r.body.detail).toContain('versión más nueva');
    });

    it('solo con el avance observado: en borrador, enviado o aprobado no hay versiones', async () => {
      const borrador = (await request(http()).post(`${base()}/avances`).set(bearer('lucia')).send({ iovId: ids.iov, valorReportado: 2, fechaCorte: hoy }).expect(201)).body.id as string;
      const ev = (await subir(borrador, PNG, 'a.png').expect(201)).body.id as string;
      const r = await version(borrador, ev, PNG2, 'b.png').expect(422);
      expect(r.body.detail).toContain('quita la evidencia');

      await request(http()).post(`${base()}/avances/${borrador}/enviar`).set(bearer('lucia')).expect(200);
      await version(borrador, ev, PNG2, 'b.png').expect(422);
      await request(http()).patch(`${base()}/avances/${borrador}/aprobar`).set(bearer('admin')).expect(200);
      await version(borrador, ev, PNG2, 'b.png').expect(422);
    });

    it('solo la autora: el Administrador y el Supervisor reciben 403; una evidencia de otro avance, 404', async () => {
      const a = await observado();
      const b = await observado();
      await version(a.id, a.evidencia, PNG2, 'v2.png', 'admin').expect(403);
      await version(a.id, a.evidencia, PNG2, 'v2.png', 'supervisor').expect(403);
      await version(a.id, b.evidencia, PNG2, 'v2.png').expect(404);
    });

    it('la versión también pasa el control de tipo y tamaño', async () => {
      const a = await observado();
      await version(a.id, a.evidencia, Buffer.from([0x50, 0x4b, 0x03, 0x04, 1]), 'informe.pdf').expect(422);
    });

    it('la base exige el número siguiente, un solo reemplazo y el avance observado', async () => {
      const a = await observado();
      const insertar = (version: number, reemplaza: string, clave: string) =>
        ds.query(
          `INSERT INTO evidencias (avance_id, version, reemplaza_a, storage_key, nombre_original, mime, tamano_bytes, sha256, subido_por)
           VALUES ($1, $2, $3, $4, 'x.png', 'image/png', 10, repeat('b', 64), $5)`,
          [a.id, version, reemplaza, `avances/${a.id}/${clave}`, ids.lucia],
        );
      await expect(insertar(5, a.evidencia, 'salto.png')).rejects.toThrow('debe ser la 2');
      await insertar(2, a.evidencia, 'v2.png');
      await expect(insertar(2, a.evidencia, 'v2-bis.png')).rejects.toThrow('uq_evidencia_reemplazo');
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