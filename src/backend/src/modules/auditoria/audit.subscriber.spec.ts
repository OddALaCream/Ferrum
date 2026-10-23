import { DataSource, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { AuditSubscriber } from './audit.subscriber';
import { AuditoriaService } from './auditoria.service';
import type { ColumnaAuditable } from './registro-auditoria';

const PROYECTO = '33333333-3333-4333-8333-333333333333';

const columna = (databaseName: string, propiedad = databaseName): ColumnaAuditable => ({
  databaseName,
  getEntityValue: (e) => e[propiedad],
});

const id = columna('id');
const estado = columna('estado');
const deletedAt = columna('deleted_at', 'deletedAt');
const metaProyectos = { tableName: 'proyectos', columns: [id, estado, deletedAt], primaryColumns: [id] };

describe('AuditSubscriber', () => {
  const manager = {};
  let registrar: jest.Mock;
  let subscriber: AuditSubscriber;
  let dataSource: { subscribers: unknown[] };

  beforeEach(() => {
    registrar = jest.fn();
    dataSource = { subscribers: [] };
    subscriber = new AuditSubscriber(
      dataSource as unknown as DataSource,
      { registrar } as unknown as AuditoriaService,
    );
  });

  it('se registra como subscriber de TypeORM', () => {
    expect(dataSource.subscribers).toContain(subscriber);
  });

  it('registra la creación con el valor nuevo completo', async () => {
    await subscriber.afterInsert({
      manager,
      metadata: metaProyectos,
      entity: { id: PROYECTO, estado: 'PLANIFICACION', deletedAt: null },
    } as unknown as InsertEvent<object>);

    expect(registrar).toHaveBeenCalledWith(manager, {
      accion: 'CREAR',
      entidad: 'proyectos',
      entidadId: PROYECTO,
      proyectoId: PROYECTO,
      valorAnterior: null,
      valorNuevo: { id: PROYECTO, estado: 'PLANIFICACION', deleted_at: null },
    });
  });

  it('registra la actualización solo con las columnas que cambiaron', async () => {
    await subscriber.afterUpdate({
      manager,
      metadata: metaProyectos,
      databaseEntity: { id: PROYECTO, estado: 'EN_EJECUCION' },
      entity: { id: PROYECTO, estado: 'PAUSADO' },
      updatedColumns: [estado],
      updatedRelations: [],
    } as unknown as UpdateEvent<object>);

    expect(registrar).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        accion: 'ACTUALIZAR',
        valorAnterior: { estado: 'EN_EJECUCION' },
        valorNuevo: { estado: 'PAUSADO' },
      }),
    );
  });

  it('un borrado lógico se registra como ELIMINAR', async () => {
    await subscriber.afterUpdate({
      manager,
      metadata: metaProyectos,
      databaseEntity: { id: PROYECTO, deletedAt: null },
      entity: { id: PROYECTO, deletedAt: new Date('2026-10-23T00:00:00.000Z') },
      updatedColumns: [deletedAt],
      updatedRelations: [],
    } as unknown as UpdateEvent<object>);

    expect(registrar).toHaveBeenCalledWith(manager, expect.objectContaining({ accion: 'ELIMINAR' }));
  });

  it('no registra una actualización sin cambios reales', async () => {
    await subscriber.afterUpdate({
      manager,
      metadata: metaProyectos,
      databaseEntity: { id: PROYECTO, estado: 'PAUSADO' },
      entity: { id: PROYECTO, estado: 'PAUSADO' },
      updatedColumns: [estado],
      updatedRelations: [],
    } as unknown as UpdateEvent<object>);

    expect(registrar).not.toHaveBeenCalled();
  });

  it('registra el borrado físico con el valor anterior', async () => {
    await subscriber.afterRemove({
      manager,
      metadata: metaProyectos,
      databaseEntity: { id: PROYECTO, estado: 'CERRADO' },
      entity: {},
      entityId: PROYECTO,
    } as unknown as RemoveEvent<object>);

    expect(registrar).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        accion: 'ELIMINAR',
        entidadId: PROYECTO,
        valorAnterior: { id: PROYECTO, estado: 'CERRADO' },
        valorNuevo: null,
      }),
    );
  });

  it('no audita la propia bitácora ni los tokens de sesión', async () => {
    for (const tableName of ['audit_log', 'refresh_tokens', 'password_reset_tokens']) {
      await subscriber.afterInsert({
        manager,
        metadata: { tableName, columns: [id], primaryColumns: [id] },
        entity: { id: '1' },
      } as unknown as InsertEvent<object>);
    }
    expect(registrar).not.toHaveBeenCalled();
  });
});
