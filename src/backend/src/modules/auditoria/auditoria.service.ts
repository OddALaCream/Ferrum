import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ContextoAuditoria } from './contexto-auditoria';
import { ConsultarAuditoriaDto } from './dto/consultar-auditoria.dto';
import { AuditLog } from './entities/audit-log.entity';
import type { AccionAuditoria, Valores } from './registro-auditoria';

/** Zona horaria del sistema (SRS: America/La_Paz, UTC−4) para interpretar los filtros de fecha. */
export const ZONA_HORARIA = 'America/La_Paz';

export interface EntradaAuditoria {
  accion: AccionAuditoria;
  entidad: string;
  entidadId: string | null;
  proyectoId: string | null;
  valorAnterior: Valores | null;
  valorNuevo: Valores | null;
}

export interface RegistroAuditoriaDto {
  id: string;
  fecha: string;
  usuarioId: string | null;
  usuarioEmail: string | null;
  usuarioNombre: string | null;
  accion: string;
  entidad: string;
  entidadId: string | null;
  proyectoId: string | null;
  proyectoCodigo: string | null;
  valorAnterior: Valores | null;
  valorNuevo: Valores | null;
  ip: string | null;
  userAgent: string | null;
}

export interface PaginaAuditoria {
  items: RegistroAuditoriaDto[];
  total: number;
  pagina: number;
  limite: number;
}

export interface OpcionesAuditoria {
  usuarios: { id: string; nombre: string; email: string }[];
  entidades: string[];
  proyectos: { id: string; codigo: string; nombre: string }[];
}

interface FilaAuditoria {
  id: string;
  fecha: Date;
  usuario_id: string | null;
  usuario_email: string | null;
  usuario_nombre: string | null;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  proyecto_id: string | null;
  proyecto_codigo: string | null;
  valor_anterior: Valores | null;
  valor_nuevo: Valores | null;
  ip: string | null;
  user_agent: string | null;
}

@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(AuditLog) private readonly bitacora: Repository<AuditLog>,
    private readonly contexto: ContextoAuditoria,
  ) {}

  /**
   * Inserta un registro usando el EntityManager de la operación auditada: si la operación
   * se revierte, el registro también; si el registro falla, la operación no se confirma.
   */
  async registrar(manager: EntityManager, entrada: EntradaAuditoria): Promise<void> {
    const peticion = this.contexto.actual();
    const registro: Omit<AuditLog, 'id' | 'createdAt'> = {
      ...entrada,
      usuarioId: peticion?.usuarioId ?? null,
      usuarioEmail: peticion?.usuarioEmail ?? null,
      ip: peticion?.ip ?? null,
      userAgent: peticion?.userAgent ?? null,
    };
    // El tipado de TypeORM no admite Record<string, unknown> en columnas jsonb
    await manager.insert(AuditLog, registro as QueryDeepPartialEntity<AuditLog>);
  }

  /** RF-34 / SGP-59: consulta paginada, de lo más reciente a lo más antiguo. */
  async consultar(filtros: ConsultarAuditoriaDto): Promise<PaginaAuditoria> {
    const { pagina, limite } = filtros;
    const consulta = this.filtrar(this.bitacora.createQueryBuilder('a'), filtros);

    const [total, filas] = await Promise.all([
      consulta.getCount(),
      consulta
        .clone()
        .leftJoin('usuarios', 'u', 'u.id = a.usuario_id')
        .leftJoin('proyectos', 'p', 'p.id = a.proyecto_id')
        .select([
          'a.id AS id',
          'a.created_at AS fecha',
          'a.usuario_id AS usuario_id',
          'a.usuario_email AS usuario_email',
          'u.nombre AS usuario_nombre',
          'a.accion AS accion',
          'a.entidad AS entidad',
          'a.entidad_id AS entidad_id',
          'a.proyecto_id AS proyecto_id',
          'p.codigo AS proyecto_codigo',
          'a.valor_anterior AS valor_anterior',
          'a.valor_nuevo AS valor_nuevo',
          'host(a.ip) AS ip',
          'a.user_agent AS user_agent',
        ])
        .orderBy('a.created_at', 'DESC')
        .addOrderBy('a.id', 'DESC')
        .offset((pagina - 1) * limite)
        .limit(limite)
        .getRawMany<FilaAuditoria>(),
    ]);

    return { items: filas.map(aDto), total, pagina, limite };
  }

  /** Valores para los filtros de la vista: usuarios, entidades presentes en la bitácora y proyectos. */
  async opciones(): Promise<OpcionesAuditoria> {
    const [usuarios, entidades, proyectos] = await Promise.all([
      this.bitacora.manager.query<{ id: string; nombre: string; email: string }[]>(
        'SELECT id, nombre, email FROM usuarios ORDER BY nombre',
      ),
      this.bitacora.manager.query<{ entidad: string }[]>(
        'SELECT DISTINCT entidad FROM audit_log ORDER BY entidad',
      ),
      this.bitacora.manager.query<{ id: string; codigo: string; nombre: string }[]>(
        'SELECT id, codigo, nombre FROM proyectos ORDER BY codigo',
      ),
    ]);
    return { usuarios, entidades: entidades.map((e) => e.entidad), proyectos };
  }

  private filtrar(qb: SelectQueryBuilder<AuditLog>, f: ConsultarAuditoriaDto): SelectQueryBuilder<AuditLog> {
    if (f.usuarioId) qb.andWhere('a.usuario_id = :usuarioId', { usuarioId: f.usuarioId });
    if (f.entidad) qb.andWhere('a.entidad = :entidad', { entidad: f.entidad });
    if (f.proyectoId) qb.andWhere('a.proyecto_id = :proyectoId', { proyectoId: f.proyectoId });
    // Día completo en la hora local: [desde 00:00, hasta + 1 día 00:00)
    if (f.desde) {
      qb.andWhere('a.created_at >= (CAST(:desde AS date)::timestamp AT TIME ZONE :zona)', {
        desde: f.desde,
        zona: ZONA_HORARIA,
      });
    }
    if (f.hasta) {
      qb.andWhere('a.created_at < ((CAST(:hasta AS date) + 1)::timestamp AT TIME ZONE :zona)', {
        hasta: f.hasta,
        zona: ZONA_HORARIA,
      });
    }
    return qb;
  }
}

function aDto(f: FilaAuditoria): RegistroAuditoriaDto {
  return {
    id: String(f.id),
    fecha: new Date(f.fecha).toISOString(),
    usuarioId: f.usuario_id,
    usuarioEmail: f.usuario_email,
    usuarioNombre: f.usuario_nombre,
    accion: f.accion,
    entidad: f.entidad,
    entidadId: f.entidad_id,
    proyectoId: f.proyecto_id,
    proyectoCodigo: f.proyecto_codigo,
    valorAnterior: f.valor_anterior,
    valorNuevo: f.valor_nuevo,
    ip: f.ip,
    userAgent: f.user_agent,
  };
}
