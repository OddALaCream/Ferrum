import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/common/filters/problem-details.filter';
import { borrarProyectosDePrueba } from './helpers/limpieza';

/**
 * Cada rol ve solo lo suyo: el Administrador todo; el Supervisor, los proyectos que supervisa;
 * el Técnico, sus proyectos y, dentro de ellos, sus actividades y tareas.
 * Requiere la BD con sgp_definitivo.sql (cuentas de demostración) aplicado.
 */
describe('Visibilidad por rol (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  type Rol = 'admin' | 'rodrigo' | 'gabriela' | 'lucia' | 'marco';
  const tokens: Record<Rol, string> = { admin: '', rodrigo: '', gabriela: '', lucia: '', marco: '' };
  const ids = { rodrigo: '', gabriela: '', lucia: '', marco: '', proyectoA: '', proyectoB: '', actLucia: '', actMarco: '' };
  const sufijo = `ROL-${Date.now()}`.slice(0, 26);
  const bearer = (r: Rol) => ({ Authorization: `Bearer ${tokens[r]}` });
  const http = () => app.getHttpServer();
  const get = (r: Rol, ruta: string) => request(http()).get(`/api${ruta}`).set(bearer(r));

  const login = async (email: string) =>
    (await request(http()).post('/api/auth/login').send({ email, password: 'Serfamilia2026' }).expect(200)).body.accessToken as string;
  const idDe = async (email: string) => (await ds.query(`SELECT id FROM usuarios WHERE email = $1`, [email]))[0].id as string;
  const crearProyecto = async (codigo: string) =>
    (await request(http()).post('/api/proyectos').set(bearer('admin')).send({ codigo, nombre: `Proyecto ${codigo}`, fechaInicio: '2026-11-01', fechaFin: '2027-05-31' }).expect(201)).body.id as string;
  const asignar = (ruta: string, usuarioId: string) =>
    request(http()).post(`/api${ruta}`).set(bearer('admin')).send({ usuarioId });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    ds = app.get(DataSource);

    const cuentas: Record<Rol, string> = {
      admin: 'admin@serfamilia.test', rodrigo: 'supervisor@serfamilia.test', gabriela: 'gabriela.choque@serfamilia.test',
      lucia: 'tecnico@serfamilia.test', marco: 'marco.huanca@serfamilia.test',
    };
    for (const [rol, email] of Object.entries(cuentas) as [Rol, string][]) tokens[rol] = await login(email);
    ids.rodrigo = await idDe(cuentas.rodrigo);
    ids.gabriela = await idDe(cuentas.gabriela);
    ids.lucia = await idDe(cuentas.lucia);
    ids.marco = await idDe(cuentas.marco);

    // Proyecto A: lo supervisa Rodrigo; trabajan Lucía y Marco. Proyecto B: lo supervisa Gabriela; trabaja solo Marco.
    ids.proyectoA = await crearProyecto(`${sufijo}-A`);
    ids.proyectoB = await crearProyecto(`${sufijo}-B`);
    await asignar(`/proyectos/${ids.proyectoA}/supervisores`, ids.rodrigo).expect(201);
    await asignar(`/proyectos/${ids.proyectoB}/supervisores`, ids.gabriela).expect(201);
    await asignar(`/proyectos/${ids.proyectoA}/equipo`, ids.lucia).expect(201);
    await asignar(`/proyectos/${ids.proyectoA}/equipo`, ids.marco).expect(201);
    await asignar(`/proyectos/${ids.proyectoB}/equipo`, ids.marco).expect(201);

    const resultado = (
      await request(http()).post(`/api/proyectos/${ids.proyectoA}/resultados`).set(bearer('admin')).send({ codigo: 'R.1', descripcion: 'Resultado de prueba' }).expect(201)
    ).body.id as string;
    const actividad = async (codigo: string, responsableId: string) =>
      (
        await request(http())
          .post(`/api/proyectos/${ids.proyectoA}/resultados/${resultado}/actividades`)
          .set(bearer('admin'))
          .send({ codigo, nombre: `Actividad ${codigo}`, tipoCronograma: 'CONTINUO', fechaInicio: '2026-11-02', fechaFin: '2027-01-29', responsableId })
          .expect(201)
      ).body.id as string;
    ids.actLucia = await actividad('A.1.1', ids.lucia);
    ids.actMarco = await actividad('A.1.2', ids.marco);
    // La actividad de Lucía ya venció (para probar las retrasadas sin depender de la fecha de hoy)
    await ds.query(`UPDATE actividades SET fecha_inicio = CURRENT_DATE - 30, fecha_fin = CURRENT_DATE - 3 WHERE id = $1`, [ids.actLucia]);
  });

  afterAll(async () => {
    await borrarProyectosDePrueba(ds, 'ROL-');
    await app.close();
  });

  const codigosVisibles = async (r: Rol) =>
    ((await get(r, `/proyectos?q=${sufijo}&limit=50`).expect(200)).body.items as { codigo: string }[]).map((p) => p.codigo).sort();

  describe('Administrador: ve todo', () => {
    it('lista los dos proyectos y recibe el marco lógico completo', async () => {
      expect(await codigosVisibles('admin')).toEqual([`${sufijo}-A`, `${sufijo}-B`]);
      const arbol = (await get('admin', `/proyectos/${ids.proyectoA}/marco-logico`).expect(200)).body;
      expect(arbol.alcance).toBe('COMPLETO');
      expect(arbol.resultados[0].actividades).toHaveLength(2);
    });
  });

  describe('Supervisor: solo los proyectos que supervisa', () => {
    it('Rodrigo ve el A y no el B; Gabriela, al revés', async () => {
      expect(await codigosVisibles('rodrigo')).toEqual([`${sufijo}-A`]);
      expect(await codigosVisibles('gabriela')).toEqual([`${sufijo}-B`]);
    });

    it('Rodrigo abre el proyecto A y su marco lógico completo, pero no el B (403)', async () => {
      await get('rodrigo', `/proyectos/${ids.proyectoA}`).expect(200);
      const arbol = (await get('rodrigo', `/proyectos/${ids.proyectoA}/marco-logico`).expect(200)).body;
      expect(arbol.alcance).toBe('COMPLETO');
      expect(arbol.resultados[0].actividades).toHaveLength(2);

      await get('rodrigo', `/proyectos/${ids.proyectoB}`).expect(403);
      await get('rodrigo', `/proyectos/${ids.proyectoB}/marco-logico`).expect(403);
      await get('rodrigo', `/proyectos/${ids.proyectoB}/equipo`).expect(403);
      await get('rodrigo', `/proyectos/${ids.proyectoB}/supervisores`).expect(403);
    });

    it('los indicadores solo cuentan los proyectos que supervisa', async () => {
      const [{ n }] = await ds.query(
        `SELECT COUNT(*)::int AS n FROM proyecto_supervisores ps JOIN proyectos p ON p.id = ps.proyecto_id
          WHERE ps.usuario_id = $1 AND ps.retirado_at IS NULL AND p.deleted_at IS NULL`,
        [ids.rodrigo],
      );
      const resumen = (await get('rodrigo', '/proyectos/resumen').expect(200)).body;
      expect(resumen.totalProyectos).toBe(n);
      expect(resumen.actividades.total).toBeGreaterThanOrEqual(2);
    });

    it('el Supervisor consulta, no modifica: no asigna supervisores ni crea resultados (403)', async () => {
      await request(http()).post(`/api/proyectos/${ids.proyectoA}/supervisores`).set(bearer('rodrigo')).send({ usuarioId: ids.gabriela }).expect(403);
      await request(http()).post(`/api/proyectos/${ids.proyectoA}/resultados`).set(bearer('rodrigo')).send({ codigo: 'R.9', descripcion: 'x' }).expect(403);
    });

    it('un supervisor puede estar en muchos proyectos y un proyecto en varios supervisores', async () => {
      await asignar(`/proyectos/${ids.proyectoB}/supervisores`, ids.rodrigo).expect(201);
      expect(await codigosVisibles('rodrigo')).toEqual([`${sufijo}-A`, `${sufijo}-B`]);
      const supervisores = (await get('admin', `/proyectos/${ids.proyectoB}/supervisores`).expect(200)).body as { nombre: string }[];
      expect(supervisores.map((s) => s.nombre).sort()).toEqual(['Gabriela Choque Apaza', 'Rodrigo Mamani']);
      // La columna del listado junta sus nombres
      const fila = (await get('admin', `/proyectos?q=${sufijo}-B`).expect(200)).body.items[0];
      expect(fila.supervisores).toBe('Gabriela Choque Apaza, Rodrigo Mamani');
    });
  });

  describe('Técnico: solo sus proyectos y, dentro, sus actividades', () => {
    it('Lucía ve el proyecto A, no el B', async () => {
      expect(await codigosVisibles('lucia')).toEqual([`${sufijo}-A`]);
      await get('lucia', `/proyectos/${ids.proyectoB}`).expect(403);
      await get('lucia', `/proyectos/${ids.proyectoB}/marco-logico`).expect(403);
    });

    it('en el marco lógico recibe solo las actividades que tiene a su cargo', async () => {
      const arbol = (await get('lucia', `/proyectos/${ids.proyectoA}/marco-logico`).expect(200)).body;
      expect(arbol.alcance).toBe('MIS_ACTIVIDADES');
      const codigos = arbol.resultados.flatMap((r: { actividades: { codigo: string }[] }) => r.actividades.map((a) => a.codigo));
      expect(codigos).toEqual(['A.1.1']);
    });

    it('Marco, en el mismo proyecto, ve solo la suya; y en el B es el único técnico', async () => {
      const arbol = (await get('marco', `/proyectos/${ids.proyectoA}/marco-logico`).expect(200)).body;
      expect(arbol.resultados[0].actividades.map((a: { codigo: string }) => a.codigo)).toEqual(['A.1.2']);
      expect(await codigosVisibles('marco')).toEqual([`${sufijo}-A`, `${sufijo}-B`]);
    });

    it('un resultado donde no tiene actividades no aparece', async () => {
      await request(http()).post(`/api/proyectos/${ids.proyectoB}/resultados`).set(bearer('admin')).send({ codigo: 'R.1', descripcion: 'Sin actividades de Lucía' }).expect(201);
      // Lucía no está en B (403); Marco sí, y B no tiene actividades suyas: no recibe resultados vacíos
      const arbol = (await get('marco', `/proyectos/${ids.proyectoB}/marco-logico`).expect(200)).body;
      expect(arbol.resultados).toEqual([]);
    });

    it('no asigna ni quita supervisores, ni los administra (403)', async () => {
      await request(http()).post(`/api/proyectos/${ids.proyectoA}/supervisores`).set(bearer('lucia')).send({ usuarioId: ids.gabriela }).expect(403);
      await get('lucia', `/proyectos/${ids.proyectoA}/supervisores/disponibles`).expect(403);
    });

    it('sí ve quién supervisa su proyecto', async () => {
      const lista = (await get('lucia', `/proyectos/${ids.proyectoA}/supervisores`).expect(200)).body as { nombre: string }[];
      expect(lista.map((s) => s.nombre)).toEqual(['Rodrigo Mamani']);
    });
  });

  describe('Seguimiento: lo atrasado y lo que le toca a cada uno', () => {
    const delProyecto = <T extends { proyectoCodigo: string }>(filas: T[]): T[] => filas.filter((f) => f.proyectoCodigo.startsWith(sufijo));

    it('el Administrador y el Supervisor del proyecto ven la actividad retrasada; el otro supervisor no', async () => {
      for (const rol of ['admin', 'rodrigo'] as const) {
        const filas = delProyecto((await get(rol, '/seguimiento/retrasadas').expect(200)).body as { codigo: string; proyectoCodigo: string; diasAtraso: number; resultadoCodigo: string }[]);
        expect(filas.map((f) => f.codigo)).toEqual(['A.1.1']);
        expect(filas[0]).toMatchObject({ diasAtraso: 3, resultadoCodigo: 'R.1' });
      }
      expect(delProyecto((await get('gabriela', '/seguimiento/retrasadas').expect(200)).body)).toEqual([]);
    });

    it('Lucía ve su actividad retrasada; Marco no ve la de Lucía', async () => {
      expect(delProyecto((await get('lucia', '/seguimiento/retrasadas').expect(200)).body)).toHaveLength(1);
      expect(delProyecto((await get('marco', '/seguimiento/retrasadas').expect(200)).body)).toEqual([]);
    });

    it('"Mi trabajo" muestra solo lo del técnico, con lo retrasado primero', async () => {
      const mio = (await get('lucia', '/seguimiento/mi-trabajo').expect(200)).body;
      const deEste = mio.actividades.filter((a: { proyectoCodigo: string }) => a.proyectoCodigo.startsWith(sufijo));
      expect(deEste.map((a: { codigo: string }) => a.codigo)).toEqual(['A.1.1']);
      expect(deEste[0]).toMatchObject({ retrasada: true, estado: 'PENDIENTE' });
      expect(mio.resumen.actividadesRetrasadas).toBeGreaterThanOrEqual(1);
      expect(mio.actividades[0].retrasada).toBe(true);
    });

    it('"Mi trabajo" incluye las tareas de sus actividades y las que le delegaron', async () => {
      // La fecha límite debe caer dentro del cronograma de la actividad (que quedó en el pasado)
      const [{ limite }] = await ds.query(`SELECT to_char(CURRENT_DATE - 10, 'YYYY-MM-DD') AS limite`);
      await request(http()).post(`/api/proyectos/${ids.proyectoA}/actividades/${ids.actLucia}/tareas`).set(bearer('lucia')).send({ nombre: 'Tarea de Lucía', fechaLimite: limite }).expect(201);
      const mio = (await get('lucia', '/seguimiento/mi-trabajo').expect(200)).body;
      const tareas = mio.tareas.filter((t: { proyectoCodigo: string }) => t.proyectoCodigo.startsWith(sufijo));
      expect(tareas.map((t: { nombre: string }) => t.nombre)).toEqual(['Tarea de Lucía']);
      expect(tareas[0]).toMatchObject({ vencida: true, actividadCodigo: 'A.1.1' });
      // Marco no la ve: la actividad es de Lucía
      const deMarco = (await get('marco', '/seguimiento/mi-trabajo').expect(200)).body;
      expect(deMarco.tareas.filter((t: { proyectoCodigo: string }) => t.proyectoCodigo.startsWith(sufijo))).toEqual([]);
    });

    it('el panel "Mi trabajo" es solo del Técnico (403 para los demás)', async () => {
      await get('admin', '/seguimiento/mi-trabajo').expect(403);
      await get('rodrigo', '/seguimiento/mi-trabajo').expect(403);
    });

    it('los indicadores del Técnico cuentan solo sus actividades', async () => {
      const [{ n }] = await ds.query(
        `SELECT COUNT(*)::int AS n FROM actividades a
           JOIN resultados r ON r.id = a.resultado_id JOIN proyectos p ON p.id = r.proyecto_id AND p.deleted_at IS NULL
          WHERE a.responsable_id = $1
            AND EXISTS (SELECT 1 FROM proyecto_equipo pe WHERE pe.proyecto_id = p.id AND pe.usuario_id = $1 AND pe.retirado_at IS NULL)`,
        [ids.lucia],
      );
      const resumen = (await get('lucia', '/proyectos/resumen').expect(200)).body;
      expect(resumen.actividades.total).toBe(n);
    });
  });

  describe('Asignar y retirar supervisores (solo el Administrador)', () => {
    it('solo se puede asignar a usuarios con rol SUPERVISOR', async () => {
      await asignar(`/proyectos/${ids.proyectoA}/supervisores`, ids.lucia).expect(404); // es técnico
      await asignar(`/proyectos/${ids.proyectoA}/supervisores`, ids.rodrigo).expect(409); // ya lo supervisa
    });

    it('"disponibles" excluye a quienes ya supervisan el proyecto', async () => {
      const lista = (await get('admin', `/proyectos/${ids.proyectoA}/supervisores/disponibles`).expect(200)).body as { nombre: string }[];
      const nombres = lista.map((s) => s.nombre);
      expect(nombres).toContain('Gabriela Choque Apaza');
      expect(nombres).not.toContain('Rodrigo Mamani');
    });

    it('al retirarlo, el Supervisor pierde el acceso en su siguiente consulta', async () => {
      await request(http()).delete(`/api/proyectos/${ids.proyectoA}/supervisores/${ids.rodrigo}`).set(bearer('admin')).expect(204);
      await get('rodrigo', `/proyectos/${ids.proyectoA}`).expect(403);
      expect(await codigosVisibles('rodrigo')).toEqual([`${sufijo}-B`]);
      await request(http()).delete(`/api/proyectos/${ids.proyectoA}/supervisores/${ids.rodrigo}`).set(bearer('admin')).expect(404);
    });
  });
});