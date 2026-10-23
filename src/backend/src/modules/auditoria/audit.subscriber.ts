import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  RemoveEvent,
  SoftRemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { AuditoriaService } from './auditoria.service';
import {
  diferencias,
  idEntidad,
  instantanea,
  proyectoDe,
  TABLAS_EXCLUIDAS,
  type MetadataAuditable,
} from './registro-auditoria';

/**
 * RF-34 / SGP-58: registra en audit_log cada INSERT, UPDATE y DELETE hecho con TypeORM,
 * con los valores anterior y nuevo, dentro de la misma transacción de la operación.
 */
@Injectable()
export class AuditSubscriber implements EntitySubscriberInterface {
  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {
    dataSource.subscribers.push(this);
  }

  async afterInsert(evento: InsertEvent<object>): Promise<void> {
    const meta = evento.metadata;
    if (this.omitir(meta)) return;
    await this.auditoria.registrar(evento.manager, {
      accion: 'CREAR',
      entidad: meta.tableName,
      entidadId: idEntidad(meta, evento.entity),
      proyectoId: proyectoDe(meta, evento.entity),
      valorAnterior: null,
      valorNuevo: instantanea(meta, evento.entity),
    });
  }

  async afterUpdate(evento: UpdateEvent<object>): Promise<void> {
    const meta = evento.metadata;
    if (this.omitir(meta) || !evento.entity) return;
    const antes = evento.databaseEntity;
    const despues = evento.entity;

    // Con save() TypeORM informa qué columnas cambiaron; con update() solo se conocen los valores nuevos.
    const cambios = antes
      ? diferencias(
          [...evento.updatedColumns, ...evento.updatedRelations.flatMap((r) => r.joinColumns)],
          antes,
          despues,
        )
      : { anterior: null, nuevo: instantanea(meta, despues) };
    if (!cambios?.nuevo || !Object.keys(cambios.nuevo).length) return;

    const borradoLogico = cambios.nuevo.deleted_at != null && cambios.anterior?.deleted_at == null;
    await this.auditoria.registrar(evento.manager, {
      accion: borradoLogico ? 'ELIMINAR' : 'ACTUALIZAR',
      entidad: meta.tableName,
      entidadId: idEntidad(meta, antes, despues),
      proyectoId: proyectoDe(meta, despues, antes),
      valorAnterior: cambios.anterior,
      valorNuevo: cambios.nuevo,
    });
  }

  async afterSoftRemove(evento: SoftRemoveEvent<object>): Promise<void> {
    const meta = evento.metadata;
    if (this.omitir(meta)) return;
    const antes = evento.databaseEntity ?? evento.entity;
    await this.auditoria.registrar(evento.manager, {
      accion: 'ELIMINAR',
      entidad: meta.tableName,
      entidadId: idEntidad(meta, antes, evento.entity),
      proyectoId: proyectoDe(meta, antes, evento.entity),
      valorAnterior: instantanea(meta, antes),
      valorNuevo: instantanea(meta, evento.entity),
    });
  }

  async afterRemove(evento: RemoveEvent<object>): Promise<void> {
    const meta = evento.metadata;
    if (this.omitir(meta)) return;
    const antes = evento.databaseEntity ?? evento.entity;
    const idEvento = evento.entityId == null ? null : String(evento.entityId).slice(0, 64);
    await this.auditoria.registrar(evento.manager, {
      accion: 'ELIMINAR',
      entidad: meta.tableName,
      entidadId: idEntidad(meta, antes) ?? idEvento,
      proyectoId: proyectoDe(meta, antes),
      valorAnterior: instantanea(meta, antes),
      valorNuevo: null,
    });
  }

  private omitir(meta: MetadataAuditable): boolean {
    return TABLAS_EXCLUIDAS.has(meta.tableName);
  }
}
