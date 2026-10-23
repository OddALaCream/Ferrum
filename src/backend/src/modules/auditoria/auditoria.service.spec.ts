import { EntityManager, Repository } from 'typeorm';
import { AuditoriaService, EntradaAuditoria } from './auditoria.service';
import { ContextoAuditoria } from './contexto-auditoria';
import { AuditLog } from './entities/audit-log.entity';

const entrada: EntradaAuditoria = {
  accion: 'ACTUALIZAR',
  entidad: 'proyectos',
  entidadId: 'p1',
  proyectoId: null,
  valorAnterior: { estado: 'EN_EJECUCION' },
  valorNuevo: { estado: 'PAUSADO' },
};

describe('AuditoriaService.registrar', () => {
  const contexto = new ContextoAuditoria();
  const service = new AuditoriaService({} as Repository<AuditLog>, contexto);
  let insert: jest.Mock;
  let manager: EntityManager;

  beforeEach(() => {
    insert = jest.fn();
    manager = { insert } as unknown as EntityManager;
  });

  it('CP-34: guarda usuario, acción, entidad, IP y valores anterior/nuevo con el manager de la operación', async () => {
    const datos = {
      usuarioId: '22222222-2222-4222-8222-222222222221',
      usuarioEmail: 'director@serfamilia.test',
      ip: '10.0.0.5',
      userAgent: 'Mozilla/5.0',
    };

    await contexto.ejecutar(datos, () => service.registrar(manager, entrada));

    expect(insert).toHaveBeenCalledWith(AuditLog, { ...entrada, ...datos });
  });

  it('fuera de una petición HTTP registra sin usuario ni IP', async () => {
    await service.registrar(manager, entrada);

    expect(insert).toHaveBeenCalledWith(AuditLog, {
      ...entrada,
      usuarioId: null,
      usuarioEmail: null,
      ip: null,
      userAgent: null,
    });
  });

  it('propaga el error para que la operación auditada no se confirme', async () => {
    insert.mockRejectedValue(new Error('fallo de BD'));
    await expect(service.registrar(manager, entrada)).rejects.toThrow('fallo de BD');
  });
});
