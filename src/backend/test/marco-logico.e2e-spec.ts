import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { borrarProyectosDePrueba } from './helpers/limpieza';

/**
 * Sprint 2 (SGP-9, 10, 79, 81, 111, 113): marco lógico de un proyecto, de punta a punta.
 * Requiere la BD con migraciones y database/03_usuarios_demo.sql aplicados.
 */
describe('Marco lógico (e2e, RF-05 a RF-15, RF-24, RF-25)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const tokens = { admin: '', supervisor: '', tecnico: '', otro: '' };
  const bearer = (r: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[r]}` });
  const codigo = `ML-${Date.now()}`.slice(0, 30);
  let proyectoId: string;
  let tecnicoId: string;
  let resultadoId: string;
  let indicadorId: string;
  let continuaId: string;
  let discretaId: string;
  let sesionIds: string[] = [];
  let tareaId: string;

  const http = () => app.getHttpServer();
  const login = async (email: string) =>
    (await request(http()).post('/api/auth/login').send({ email, password: 'Serfamilia2026' }).expect(200)).body.accessToken as string;
  const base = () => `/api/proyectos/${proyectoId}`;

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
    // Un segundo técnico que NO es responsable de las actividades
    await ds.query(`UPDATE usuarios SET activo = true, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE email = 'marco.huanca@serfamilia.test'`);
    try {
      tokens.otro = await login('marco.huanca@serfamilia.test'); // requiere database/04_datos_demo.sql
    } catch {
      tokens.otro = '';
    }
    [{ id: tecnicoId }] = await ds.query(`SELECT id FROM usuarios WHERE email = 'tecnico@serfamilia.test'`);

    proyectoId = (
      await request(http())
        .post('/api/proyectos')
        .set(bearer('admin'))
        .send({ codigo, nombre: 'Proyecto de marco lógico', fechaInicio: '2026-11-01', fechaFin: '2027-05-31' })
        .expect(201)
    ).body.id;
    await request(http()).post(`${base()}/equipo`).set(bearer('admin')).send({ usuarioId: tecnicoId }).expect(201);
  });

  afterAll(async () => {
    await borrarProyectosDePrueba(ds, 'ML-');
    await app.close();
  });

  describe('Resultados (SGP-9)', () => {
    it('el Administrador crea R.1 y la respuesta trae los datos', async () => {
      const res = await request(http())
        .post(`${base()}/resultados`)
        .set(bearer('admin'))
        .send({ codigo: 'R.1', descripcion: 'Las personas de la zona se llevan bien' })
        .expect(201);
      resultadoId = res.body.id;
      expect(res.body).toMatchObject({ codigo: 'R.1', peso: 0, cumplimientoPct: 0 });
    });

    it('CP-05: un código repetido en el mismo proyecto responde 409', async () => {
      await request(http()).post(`${base()}/resultados`).set(bearer('admin')).send({ codigo: 'R.1', descripcion: 'otro' }).expect(409);
    });

    it('el Técnico y el Supervisor no pueden crear resultados (403)', async () => {
      await request(http()).post(`${base()}/resultados`).set(bearer('tecnico')).send({ codigo: 'R.9', descripcion: 'x' }).expect(403);
      await request(http()).post(`${base()}/resultados`).set(bearer('supervisor')).send({ codigo: 'R.9', descripcion: 'x' }).expect(403);
    });
  });

  describe('Indicadores I.O.V. (SGP-10 y SGP-79)', () => {
    it('crea un indicador con unidad, meta y fuente de verificación; la línea base queda en 0', async () => {
      const res = await request(http())
        .post(`${base()}/resultados/${resultadoId}/indicadores`)
        .set(bearer('admin'))
        .send({
          codigo: 'I.O.V. 1.1',
          descripcion: 'Al final del proyecto, el 80 % de las familias participa en las reuniones de vecinos',
          unidad: '%',
          meta: 80,
          peso: 60,
          fuenteVerificacion: 'Actas de reunión y listas de asistencia',
        })
        .expect(201);
      indicadorId = res.body.id;
      expect(res.body).toMatchObject({ lineaBase: 0, meta: 80, peso: 60, unidad: '%' });
    });

    it('CP-07: una meta igual a la línea base se rechaza con 400', async () => {
      const res = await request(http())
        .post(`${base()}/resultados/${resultadoId}/indicadores`)
        .set(bearer('admin'))
        .send({ codigo: 'I.O.V. 1.9', descripcion: 'x', unidad: '%', lineaBase: 10, meta: 10, fuenteVerificacion: 'x' })
        .expect(400);
      expect(res.body.detail).toContain('distinta de la línea base');
    });

    it('la suma de pesos no puede superar el 100 % (422)', async () => {
      await request(http())
        .post(`${base()}/resultados/${resultadoId}/indicadores`)
        .set(bearer('admin'))
        .send({ codigo: 'I.O.V. 1.2', descripcion: 'x', unidad: 'beneficiarios', meta: 130, peso: 50, fuenteVerificacion: 'x' })
        .expect(422);
    });

    it('un código de indicador repetido responde 409', async () => {
      await request(http())
        .post(`${base()}/resultados/${resultadoId}/indicadores`)
        .set(bearer('admin'))
        .send({ codigo: 'I.O.V. 1.1', descripcion: 'x', unidad: '%', meta: 5, fuenteVerificacion: 'x' })
        .expect(409);
    });
  });

  describe('Actividades continuas y discretas (SGP-81)', () => {
    it('crea una actividad CONTINUA con su técnico responsable, meta y fuentes de verificación', async () => {
      const res = await request(http())
        .post(`${base()}/resultados/${resultadoId}/actividades`)
        .set(bearer('admin'))
        .send({
          codigo: 'A.1.1',
          nombre: 'Mantenimiento del camino principal',
          tipoCronograma: 'CONTINUO',
          fechaInicio: '2026-11-02',
          fechaFin: '2027-01-29',
          responsableId: tecnicoId,
          iovId: indicadorId,
          metaCuantitativa: 1,
          unidadMeta: 'camino mantenido',
          fuentesVerificacion: 'Informe técnico y registro fotográfico',
        })
        .expect(201);
      continuaId = res.body.id;
      expect(res.body).toMatchObject({ tipoCronograma: 'CONTINUO', estado: 'PENDIENTE', responsableId: tecnicoId, metaCuantitativa: 1 });
    });

    it('crea una actividad DISCRETA con sesiones puntuales (talleres un día a la semana)', async () => {
      const res = await request(http())
        .post(`${base()}/resultados/${resultadoId}/actividades`)
        .set(bearer('admin'))
        .send({
          codigo: 'A.1.2',
          nombre: 'Talleres de convivencia',
          tipoCronograma: 'DISCRETO',
          fechaInicio: '2026-11-02',
          fechaFin: '2026-12-31',
          responsableId: tecnicoId,
          metaCuantitativa: 4,
          unidadMeta: 'talleres',
          sesiones: ['2026-11-10', '2026-11-17', '2026-11-24', '2026-12-01'],
        })
        .expect(201);
      discretaId = res.body.id;
    });

    it('CP-09: una fecha fuera del periodo del proyecto responde 422', async () => {
      await request(http())
        .post(`${base()}/resultados/${resultadoId}/actividades`)
        .set(bearer('admin'))
        .send({ codigo: 'A.1.8', nombre: 'x', tipoCronograma: 'CONTINUO', fechaInicio: '2026-11-02', fechaFin: '2028-01-01' })
        .expect(422);
    });

    it('una fecha de fin anterior a la de inicio responde 400', async () => {
      await request(http())
        .post(`${base()}/resultados/${resultadoId}/actividades`)
        .set(bearer('admin'))
        .send({ codigo: 'A.1.8', nombre: 'x', tipoCronograma: 'CONTINUO', fechaInicio: '2026-12-02', fechaFin: '2026-11-02' })
        .expect(400);
    });

    it('CP-25: un responsable que no es del equipo del proyecto responde 422', async () => {
      const [{ id: ajeno }] = await ds.query(`SELECT id FROM usuarios WHERE email = 'supervisor@serfamilia.test'`);
      await request(http())
        .post(`${base()}/resultados/${resultadoId}/actividades`)
        .set(bearer('admin'))
        .send({ codigo: 'A.1.9', nombre: 'x', tipoCronograma: 'CONTINUO', fechaInicio: '2026-11-02', fechaFin: '2026-11-30', responsableId: ajeno })
        .expect(422);
    });

    it('una actividad continua no acepta sesiones (400) y una sesión fuera del cronograma se rechaza (422)', async () => {
      await request(http())
        .post(`${base()}/resultados/${resultadoId}/actividades`)
        .set(bearer('admin'))
        .send({ codigo: 'A.1.7', nombre: 'x', tipoCronograma: 'CONTINUO', fechaInicio: '2026-11-02', fechaFin: '2026-11-30', sesiones: ['2026-11-10'] })
        .expect(400);
      await request(http())
        .post(`${base()}/resultados/${resultadoId}/actividades`)
        .set(bearer('admin'))
        .send({ codigo: 'A.1.6', nombre: 'x', tipoCronograma: 'DISCRETO', fechaInicio: '2026-11-02', fechaFin: '2026-11-30', sesiones: ['2026-12-15'] })
        .expect(422);
    });
  });

  describe('Avance que anota el técnico (SGP-113)', () => {
    it('el árbol muestra resultado → indicador y actividades con sus sesiones', async () => {
      const res = await request(http()).get(`${base()}/marco-logico`).set(bearer('admin')).expect(200);
      const r = res.body.resultados[0];
      expect(res.body.proyecto.id).toBe(proyectoId);
      expect(r.codigo).toBe('R.1');
      expect(r.indicadores).toHaveLength(1);
      expect(r.actividades.map((a: { codigo: string }) => a.codigo)).toEqual(['A.1.1', 'A.1.2']);
      const discreta = r.actividades.find((a: { id: string }) => a.id === discretaId);
      expect(discreta.sesiones.map((s: { fecha: string }) => s.fecha)).toEqual(['2026-11-10', '2026-11-17', '2026-11-24', '2026-12-01']);
      sesionIds = discreta.sesiones.map((s: { id: string }) => s.id);
    });

    it('el Técnico responsable marca una actividad continua en curso con su avance', async () => {
      const res = await request(http())
        .patch(`${base()}/actividades/${continuaId}/estado`)
        .set(bearer('tecnico'))
        .send({ estado: 'EN_CURSO', cumplimientoPct: 40 })
        .expect(200);
      expect(res.body).toMatchObject({ estado: 'EN_CURSO', cumplimientoPct: 40 });
    });

    it('al completarla el avance queda en 100 %', async () => {
      const res = await request(http()).patch(`${base()}/actividades/${continuaId}/estado`).set(bearer('tecnico')).send({ estado: 'COMPLETADA' }).expect(200);
      expect(res.body).toMatchObject({ estado: 'COMPLETADA', cumplimientoPct: 100 });
    });

    it('el estado de una actividad discreta no se cambia a mano: se marca por sesión (422)', async () => {
      await request(http()).patch(`${base()}/actividades/${discretaId}/estado`).set(bearer('tecnico')).send({ estado: 'COMPLETADA' }).expect(422);
    });

    it('marcar sesiones realizadas actualiza el % y el estado de la actividad discreta', async () => {
      const una = await request(http()).patch(`${base()}/actividades/${discretaId}/sesiones/${sesionIds[0]}`).set(bearer('tecnico')).send({ realizada: true }).expect(200);
      expect(una.body).toMatchObject({ estado: 'EN_CURSO', cumplimientoPct: 25 });

      for (const id of sesionIds.slice(1)) {
        await request(http()).patch(`${base()}/actividades/${discretaId}/sesiones/${id}`).set(bearer('tecnico')).send({ realizada: true }).expect(200);
      }
      const todas = await request(http()).get(`${base()}/marco-logico`).set(bearer('tecnico')).expect(200);
      const a = todas.body.resultados[0].actividades.find((x: { id: string }) => x.id === discretaId);
      expect(a).toMatchObject({ estado: 'COMPLETADA', cumplimientoPct: 100 });
      expect(a.sesiones.every((s: { realizada: boolean; realizadaAt: string | null }) => s.realizada && s.realizadaAt)).toBe(true);
    });

    it('desmarcar una sesión devuelve la actividad a EN_CURSO', async () => {
      const res = await request(http()).patch(`${base()}/actividades/${discretaId}/sesiones/${sesionIds[3]}`).set(bearer('tecnico')).send({ realizada: false }).expect(200);
      expect(res.body).toMatchObject({ estado: 'EN_CURSO', cumplimientoPct: 75 });
    });

    it('un técnico que no es responsable no puede marcarla (403), ni el Supervisor', async () => {
      if (tokens.otro) {
        // Está asignado al proyecto, pero no es el responsable de la actividad
        const [{ id: otroId }] = await ds.query(`SELECT id FROM usuarios WHERE email = 'marco.huanca@serfamilia.test'`);
        await request(http()).post(`${base()}/equipo`).set(bearer('admin')).send({ usuarioId: otroId }).expect(201);
        await request(http()).patch(`${base()}/actividades/${discretaId}/sesiones/${sesionIds[3]}`).set(bearer('otro')).send({ realizada: true }).expect(403);
      }
      await request(http()).patch(`${base()}/actividades/${discretaId}/sesiones/${sesionIds[3]}`).set(bearer('supervisor')).send({ realizada: true }).expect(403);
    });

    it('una actividad vencida y sin completar aparece como RETRASADA (RN-11)', async () => {
      const res = await request(http())
        .post(`${base()}/resultados/${resultadoId}/actividades`)
        .set(bearer('admin'))
        .send({ codigo: 'A.1.5', nombre: 'Encuesta inicial', tipoCronograma: 'CONTINUO', fechaInicio: '2026-11-01', fechaFin: '2026-11-02' })
        .expect(201);
      // Se fuerza el vencimiento en el pasado para comprobar el cálculo
      await ds.query(`UPDATE actividades SET fecha_inicio = '2026-01-01', fecha_fin = '2026-01-31' WHERE id = $1`, [res.body.id]);
      const arbol = await request(http()).get(`${base()}/marco-logico`).set(bearer('admin')).expect(200);
      const a = arbol.body.resultados[0].actividades.find((x: { id: string }) => x.id === res.body.id);
      expect(a).toMatchObject({ estado: 'PENDIENTE', estadoEfectivo: 'RETRASADA' });
    });
  });

  describe('Tareas (SGP-111)', () => {
    it('el Técnico responsable crea una tarea dentro de su actividad', async () => {
      const res = await request(http())
        .post(`${base()}/actividades/${continuaId}/tareas`)
        .set(bearer('tecnico'))
        .send({ nombre: 'Reunirse con los jefes de manzana', fechaLimite: '2026-11-20', responsableId: tecnicoId })
        .expect(201);
      tareaId = res.body.id;
      expect(res.body).toMatchObject({ estado: 'PENDIENTE', cerradoAt: null });
    });

    it('al completarla se guarda la fecha de cierre, y al reabrirla se limpia', async () => {
      const hecha = await request(http()).patch(`${base()}/tareas/${tareaId}`).set(bearer('tecnico')).send({ estado: 'COMPLETADA' }).expect(200);
      expect(hecha.body.cerradoAt).toBeTruthy();
      const abierta = await request(http()).patch(`${base()}/tareas/${tareaId}`).set(bearer('tecnico')).send({ estado: 'EN_CURSO' }).expect(200);
      expect(abierta.body.cerradoAt).toBeNull();
    });

    it('el Supervisor no gestiona tareas (403) y las tareas salen dentro de la actividad', async () => {
      await request(http()).post(`${base()}/actividades/${continuaId}/tareas`).set(bearer('supervisor')).send({ nombre: 'x' }).expect(403);
      const arbol = await request(http()).get(`${base()}/marco-logico`).set(bearer('supervisor')).expect(200);
      const a = arbol.body.resultados[0].actividades.find((x: { id: string }) => x.id === continuaId);
      expect(a.tareas.map((t: { nombre: string }) => t.nombre)).toEqual(['Reunirse con los jefes de manzana']);
    });
  });

  describe('Permisos y reglas del proyecto', () => {
    it('un resultado con actividades no se puede eliminar (409)', async () => {
      await request(http()).delete(`${base()}/resultados/${resultadoId}`).set(bearer('admin')).expect(409);
    });

    it('sin sesión responde 401 y un técnico no asignado no ve el marco lógico (403)', async () => {
      await request(http()).get(`${base()}/marco-logico`).expect(401);
      const otro = await request(http())
        .post('/api/proyectos')
        .set(bearer('admin'))
        .send({ codigo: `${codigo}-B`.slice(0, 30), nombre: 'Otro', fechaInicio: '2026-11-01', fechaFin: '2027-01-31' })
        .expect(201);
      await request(http()).get(`/api/proyectos/${otro.body.id}/marco-logico`).set(bearer('tecnico')).expect(403);
    });

    it('RN-09: en un proyecto cerrado el marco lógico queda en solo lectura (422)', async () => {
      await request(http()).patch(`${base()}/estado`).set(bearer('admin')).send({ estado: 'EN_EJECUCION' }).expect(200);
      await request(http()).patch(`${base()}/estado`).set(bearer('admin')).send({ estado: 'CERRADO' }).expect(200);
      await request(http()).post(`${base()}/resultados`).set(bearer('admin')).send({ codigo: 'R.7', descripcion: 'x' }).expect(422);
      // Solo lectura: se puede consultar
      await request(http()).get(`${base()}/marco-logico`).set(bearer('admin')).expect(200);
    });
  });
});