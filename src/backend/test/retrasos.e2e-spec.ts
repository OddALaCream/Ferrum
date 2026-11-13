import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { hoyIso } from '../src/modules/marco-logico/utils/estado-efectivo';
import { borrarProyectosDePrueba } from './helpers/limpieza';

/**
 * SGP-113: fechas reales de inicio y cierre (CP-13) y proceso diario que marca las actividades vencidas (RN-11).
 * Las fechas son relativas a hoy para que la prueba no dependa del día en que se ejecute.
 */
describe('Estado de las actividades y retrasos (e2e, SGP-113)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const tokens = { admin: '', supervisor: '', tecnico: '' };
  const sufijo = `RET-${Date.now()}`.slice(0, 26);
  const hoy = hoyIso();
  const dia = (desplazamiento: number) => {
    const [a, m, d] = hoy.split('-').map(Number);
    return hoyIso(new Date(a, m - 1, d + desplazamiento));
  };
  let proyectoId = '';
  let resultadoId = '';
  let tecnicoId = '';
  const http = () => app.getHttpServer();
  const bearer = (r: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[r]}` });
  const base = (p = proyectoId) => `/api/proyectos/${p}`;
  const login = async (email: string) =>
    (await request(http()).post('/api/auth/login').send({ email, password: 'Serfamilia2026' }).expect(200)).body.accessToken as string;

  const crearProyecto = async (codigo: string) => {
    const id = (await request(http()).post('/api/proyectos').set(bearer('admin'))
      .send({ codigo, nombre: `Proyecto ${codigo}`, fechaInicio: dia(-90), fechaFin: dia(90) }).expect(201)).body.id as string;
    await request(http()).post(`${base(id)}/equipo`).set(bearer('admin')).send({ usuarioId: tecnicoId }).expect(201);
    return id;
  };
  const crearActividad = async (codigo: string, extra: Record<string, unknown> = {}, proyecto = proyectoId, resultado = resultadoId) =>
    (await request(http()).post(`${base(proyecto)}/resultados/${resultado}/actividades`).set(bearer('admin'))
      .send({ codigo, nombre: `Actividad ${codigo}`, tipoCronograma: 'CONTINUO', fechaInicio: dia(-60), fechaFin: dia(60), responsableId: tecnicoId, ...extra })
      .expect(201)).body as { id: string };
  const estadoGuardado = async (id: string) => (await ds.query(`SELECT estado FROM actividades WHERE id = $1`, [id]))[0].estado as string;
  const vencer = (id: string) => ds.query(`UPDATE actividades SET fecha_inicio = $2, fecha_fin = $3 WHERE id = $1`, [id, dia(-30), dia(-2)]);

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

    proyectoId = await crearProyecto(`${sufijo}-A`);
    resultadoId = (await request(http()).post(`${base()}/resultados`).set(bearer('admin')).send({ codigo: 'R.1', descripcion: 'Resultado' }).expect(201)).body.id;
  });

  afterAll(async () => {
    await borrarProyectosDePrueba(ds, 'RET-');
    await app.close();
  });

  describe('CP-13: fechas reales de una actividad continua', () => {
    let id = '';
    const cambiar = (estado: string, cumplimientoPct?: number) =>
      request(http()).patch(`${base()}/actividades/${id}/estado`).set(bearer('tecnico')).send({ estado, ...(cumplimientoPct === undefined ? {} : { cumplimientoPct }) });

    beforeAll(async () => {
      id = (await crearActividad('A.1.1')).id;
    });

    it('al ponerla en curso registra la fecha real de inicio, sin cierre', async () => {
      const r = (await cambiar('EN_CURSO').expect(200)).body;
      expect(r).toMatchObject({ estado: 'EN_CURSO', fechaRealInicio: hoy, fechaRealFin: null });
    });

    it('al completarla registra la fecha de cierre y el cambio queda en la bitácora', async () => {
      const r = (await cambiar('COMPLETADA').expect(200)).body;
      expect(r).toMatchObject({ estado: 'COMPLETADA', cumplimientoPct: 100, fechaRealInicio: hoy, fechaRealFin: hoy });

      const [log] = await ds.query(
        `SELECT accion, valor_nuevo FROM audit_log WHERE entidad = 'actividades' AND entidad_id = $1 ORDER BY id DESC LIMIT 1`,
        [id],
      );
      expect(log.accion).toBe('ACTUALIZAR');
      expect(log.valor_nuevo).toMatchObject({ estado: 'COMPLETADA' });
    });

    it('el marco lógico muestra las fechas reales', async () => {
      const arbol = (await request(http()).get(`${base()}/marco-logico`).set(bearer('admin')).expect(200)).body;
      const a = arbol.resultados[0].actividades.find((x: { id: string }) => x.id === id);
      expect(a).toMatchObject({ fechaRealInicio: hoy, fechaRealFin: hoy, estadoEfectivo: 'COMPLETADA' });
    });

    it('si se reabre pierde el cierre y conserva el inicio; si vuelve a Pendiente, pierde ambas', async () => {
      // Para reabrirla hay que bajar su avance: con 100 % sigue contando como completada
      expect((await cambiar('EN_CURSO', 80).expect(200)).body).toMatchObject({ estado: 'EN_CURSO', fechaRealInicio: hoy, fechaRealFin: null });
      expect((await cambiar('PENDIENTE').expect(200)).body).toMatchObject({ fechaRealInicio: null, fechaRealFin: null });
    });
  });

  describe('CP-13: fechas reales de una actividad discreta (por sesiones)', () => {
    it('empieza con la primera sesión realizada y se cierra con la última', async () => {
      const act = await crearActividad('A.1.2', { tipoCronograma: 'DISCRETO', sesiones: [dia(-20), dia(-10)] });
      const sesiones = (await ds.query(`SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha FROM actividad_sesiones WHERE actividad_id = $1 ORDER BY fecha`, [act.id])) as { id: string; fecha: string }[];
      const marcar = (sesionId: string, realizada: boolean) =>
        request(http()).patch(`${base()}/actividades/${act.id}/sesiones/${sesionId}`).set(bearer('tecnico')).send({ realizada }).expect(200);

      expect((await marcar(sesiones[1].id, true)).body).toMatchObject({ estado: 'EN_CURSO', fechaRealInicio: dia(-10), fechaRealFin: null });
      expect((await marcar(sesiones[0].id, true)).body).toMatchObject({ estado: 'COMPLETADA', fechaRealInicio: dia(-20), fechaRealFin: dia(-10) });
      expect((await marcar(sesiones[1].id, false)).body).toMatchObject({ estado: 'EN_CURSO', fechaRealInicio: dia(-20), fechaRealFin: null });
    });
  });

  describe('Proceso diario de retrasos (RN-11)', () => {
    it('marca como RETRASADA lo vencido sin completar y reabre lo que tuvo ampliación de plazo', async () => {
      const vencida = await crearActividad('A.1.3');
      await request(http()).patch(`${base()}/actividades/${vencida.id}/estado`).set(bearer('tecnico')).send({ estado: 'EN_CURSO', cumplimientoPct: 40 }).expect(200);
      await vencer(vencida.id);

      const ampliada = await crearActividad('A.1.4');
      await ds.query(`UPDATE actividades SET estado = 'RETRASADA', cumplimiento_pct = 30 WHERE id = $1`, [ampliada.id]);

      const completada = await crearActividad('A.1.5');
      await request(http()).patch(`${base()}/actividades/${completada.id}/estado`).set(bearer('tecnico')).send({ estado: 'COMPLETADA' }).expect(200);
      await vencer(completada.id);

      const r = (await request(http()).post('/api/seguimiento/marcar-retrasadas').set(bearer('admin')).expect(200)).body;
      expect(r.marcadas).toBeGreaterThanOrEqual(1);
      expect(r.reabiertas).toBeGreaterThanOrEqual(1);

      expect(await estadoGuardado(vencida.id)).toBe('RETRASADA');
      expect(await estadoGuardado(ampliada.id)).toBe('EN_CURSO'); // tenía 30 % de avance
      expect(await estadoGuardado(completada.id)).toBe('COMPLETADA'); // lo completado nunca se toca
    });

    it('no toca las actividades de un proyecto cerrado', async () => {
      const cerrado = await crearProyecto(`${sufijo}-C`);
      const res = (await request(http()).post(`${base(cerrado)}/resultados`).set(bearer('admin')).send({ codigo: 'R.1', descripcion: 'x' }).expect(201)).body.id;
      const act = await crearActividad('A.1.1', {}, cerrado, res);
      for (const estado of ['EN_EJECUCION', 'CERRADO']) {
        await request(http()).patch(`${base(cerrado)}/estado`).set(bearer('admin')).send({ estado }).expect(200);
      }
      await vencer(act.id);

      await request(http()).post('/api/seguimiento/marcar-retrasadas').set(bearer('admin')).expect(200);
      expect(await estadoGuardado(act.id)).toBe('PENDIENTE');
    });

    it('una actividad retrasada a la que se le amplía el plazo deja de estarlo al editarla', async () => {
      const act = await crearActividad('A.1.6');
      await vencer(act.id);
      await request(http()).post('/api/seguimiento/marcar-retrasadas').set(bearer('admin')).expect(200);
      expect(await estadoGuardado(act.id)).toBe('RETRASADA');

      const r = (await request(http()).patch(`${base()}/actividades/${act.id}`).set(bearer('admin')).send({ fechaFin: dia(30) }).expect(200)).body;
      expect(r.estado).toBe('PENDIENTE');
    });

    it('solo el Administrador puede lanzarlo a mano (corre solo cada día)', async () => {
      await request(http()).post('/api/seguimiento/marcar-retrasadas').set(bearer('supervisor')).expect(403);
      await request(http()).post('/api/seguimiento/marcar-retrasadas').set(bearer('tecnico')).expect(403);
    });
  });
});