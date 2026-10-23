import {
  diferencias,
  idEntidad,
  instantanea,
  proyectoDe,
  REDACTADO,
  type ColumnaAuditable,
  type MetadataAuditable,
} from './registro-auditoria';

const columna = (databaseName: string, propiedad = databaseName): ColumnaAuditable => ({
  databaseName,
  getEntityValue: (e) => e[propiedad],
});

const id = columna('id');
const meta = (tableName: string, ...extra: ColumnaAuditable[]): MetadataAuditable => ({
  tableName,
  columns: [id, ...extra],
  primaryColumns: [id],
});

const PROYECTO = '33333333-3333-4333-8333-333333333333';

describe('instantanea', () => {
  it('usa los nombres de columna de la BD y serializa fechas', () => {
    const m = meta('proyectos', columna('presupuesto_total', 'presupuestoTotal'), columna('created_at', 'createdAt'));
    const valores = instantanea(m, {
      id: 'p1',
      presupuestoTotal: '850000.50',
      createdAt: new Date('2026-10-23T04:00:00.000Z'),
    });
    expect(valores).toEqual({ id: 'p1', presupuesto_total: '850000.50', created_at: '2026-10-23T04:00:00.000Z' });
  });

  it('oculta contraseñas, tokens y secretos', () => {
    const m = meta('usuarios', columna('password_hash', 'passwordHash'), columna('email'));
    expect(instantanea(m, { id: 'u1', passwordHash: '$2b$12$abc', email: 'a@b.c' })).toEqual({
      id: 'u1',
      password_hash: REDACTADO,
      email: 'a@b.c',
    });
  });

  it('no repite una columna declarada como FK explícita y como relación', () => {
    const m = meta('proyectos', columna('financiador_id', 'financiadorId'), columna('financiador_id', 'financiador'));
    expect(instantanea(m, { id: 'p1', financiadorId: 'f1' })).toEqual({ id: 'p1', financiador_id: 'f1' });
  });

  it('devuelve null sin entidad', () => {
    expect(instantanea(meta('proyectos'), undefined)).toBeNull();
  });
});

describe('diferencias', () => {
  const estado = columna('estado');
  const presupuesto = columna('presupuesto_total', 'presupuestoTotal');

  it('registra solo lo que cambió, con su valor anterior y nuevo', () => {
    const cambios = diferencias(
      [estado, presupuesto],
      { estado: 'PLANIFICACION', presupuestoTotal: '0.00' },
      { estado: 'EN_EJECUCION', presupuestoTotal: '0.00' },
    );
    expect(cambios).toEqual({ anterior: { estado: 'PLANIFICACION' }, nuevo: { estado: 'EN_EJECUCION' } });
  });

  it('compara fechas por su valor', () => {
    const retirado = columna('retirado_at', 'retiradoAt');
    const fecha = '2026-10-23T04:00:00.000Z';
    expect(diferencias([retirado], { retiradoAt: new Date(fecha) }, { retiradoAt: new Date(fecha) })).toBeNull();
    expect(diferencias([retirado], { retiradoAt: null }, { retiradoAt: new Date(fecha) })).toEqual({
      anterior: { retirado_at: null },
      nuevo: { retirado_at: fecha },
    });
  });

  it('oculta también los campos sensibles que cambian', () => {
    const clave = columna('password_hash', 'passwordHash');
    expect(diferencias([clave], { passwordHash: 'viejo' }, { passwordHash: 'nuevo' })).toEqual({
      anterior: { password_hash: REDACTADO },
      nuevo: { password_hash: REDACTADO },
    });
  });

  it('devuelve null si no hubo cambios', () => {
    expect(diferencias([estado], { estado: 'PAUSADO' }, { estado: 'PAUSADO' })).toBeNull();
  });
});

describe('idEntidad', () => {
  it('toma la clave primaria de la primera entidad que la tenga', () => {
    expect(idEntidad(meta('proyectos'), undefined, { id: 'p1' })).toBe('p1');
  });

  it('devuelve null si no se conoce', () => {
    expect(idEntidad(meta('proyectos'), {})).toBeNull();
  });
});

describe('proyectoDe', () => {
  it('en la tabla proyectos usa su propio id', () => {
    expect(proyectoDe(meta('proyectos'), { id: PROYECTO })).toBe(PROYECTO);
  });

  it('en otras tablas usa la columna proyecto_id', () => {
    const m = meta('proyecto_equipo', columna('proyecto_id', 'proyectoId'));
    expect(proyectoDe(m, { id: 'e1', proyectoId: PROYECTO })).toBe(PROYECTO);
  });

  it('devuelve null si la tabla no pertenece a un proyecto', () => {
    expect(proyectoDe(meta('financiadores'), { id: 'f1' })).toBeNull();
  });
});
