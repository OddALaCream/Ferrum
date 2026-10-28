import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';
import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { RegistrarPresupuestoDto } from './dto/registrar-presupuesto.dto';
import { UpdateEstadoProyectoDto } from './dto/update-estado-proyecto.dto';
import { ListarProyectosDto } from './dto/listar-proyectos.dto';
import { ESTADOS_PROYECTO, Proyecto, type EstadoProyecto } from './entities/proyecto.entity';
import { RolUsuario } from './entities/usuario.entity';
import { normalizarMonto } from './presupuesto';
import type { ListaProyectos, ProyectoResumen, ResumenCartera } from './types/proyectos.types';

/** Código de violación de unicidad en PostgreSQL. */
const PG_UNIQUE_VIOLATION = '23505';
/** Código de CHECK / RAISE EXCEPTION con ERRCODE 23514 (trigger de transición). */
const PG_CHECK_VIOLATION = '23514';

/**
 * Transiciones permitidas por `fn_proyecto_transicion` (database/01_schema.sql).
 * Se validan aquí para devolver 422 en vez de un 500 de Postgres.
 */
const TRANSICIONES_PERMITIDAS = new Set([
  'PLANIFICACION>EN_EJECUCION',
  'EN_EJECUCION>PAUSADO',
  'PAUSADO>EN_EJECUCION',
  'EN_EJECUCION>CERRADO',
  'PAUSADO>CERRADO',
]);

@Injectable()
export class ProyectosService {
  constructor(
    @InjectRepository(Proyecto)
    private readonly proyectos: Repository<Proyecto>,
  ) {}

  /** `creadoPorId`: el usuario de la sesión que registra el proyecto. */
  async crear(dto: CreateProyectoDto, creadoPorId: string): Promise<Proyecto> {
    const proyecto = this.proyectos.create({
      codigo: dto.codigo.trim(),
      nombre: dto.nombre.trim(),
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      estado: 'PLANIFICACION',
      presupuestoTotal: '0.00',
      moneda: 'BOB',
      creadoPorId,
    });

    try {
      return await this.proyectos.save(proyecto);
    } catch (e) {
      if (this.esCodigoDuplicado(e)) {
        throw new ConflictException(`Ya existe un proyecto con el código ${dto.codigo.trim()}.`);
      }
      throw e;
    }
  }

  /**
   * RF-04 / SGP-71: listado paginado con búsqueda por código o nombre y filtro por estado.
   * Administrador y Supervisor ven todos los proyectos; el Técnico solo aquellos donde está asignado (RN-10).
   */
  async listar(filtros: ListarProyectosDto, usuario: UsuarioAutenticado): Promise<ListaProyectos> {
    const page = filtros.page ?? 1;
    const limit = filtros.limit ?? 10;

    const qb = this.consultaVisible(usuario);
    if (filtros.q) qb.andWhere('(p.codigo ILIKE :q OR p.nombre ILIKE :q)', { q: `%${filtros.q}%` });
    if (filtros.estado) qb.andWhere('p.estado = :estado', { estado: filtros.estado });

    const total = await qb.getCount();
    const { entities, raw } = await qb
      .addSelect(
        '(SELECT COUNT(*) FROM proyecto_equipo pe WHERE pe.proyecto_id = p.id AND pe.retirado_at IS NULL)',
        'equipo_activo',
      )
      .orderBy('p.fecha_inicio', 'DESC')
      .addOrderBy('p.codigo', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawAndEntities<{ equipo_activo: string }>();

    const items: ProyectoResumen[] = entities.map((p, i) => ({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      estado: p.estado,
      presupuestoTotal: p.presupuestoTotal,
      moneda: p.moneda,
      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin,
      cumplimientoPct: p.cumplimientoPct,
      equipoActivo: Number(raw[i]?.equipo_activo ?? 0),
    }));
    return { items, total, page, limit };
  }

  /** Indicadores de la cartera que el usuario puede ver (panel del dashboard). */
  async resumen(usuario: UsuarioAutenticado): Promise<ResumenCartera> {
    const porEstadoFilas = await this.consultaVisible(usuario)
      .select('p.estado', 'estado')
      .addSelect('COUNT(*)', 'total')
      .addSelect("COALESCE(SUM(CASE WHEN p.moneda = 'BOB' THEN p.presupuesto_total ELSE 0 END), 0)", 'presupuesto')
      .groupBy('p.estado')
      .getRawMany<{ estado: EstadoProyecto; total: string; presupuesto: string }>();

    const porEstado = Object.fromEntries(ESTADOS_PROYECTO.map((e) => [e, 0])) as Record<EstadoProyecto, number>;
    let totalProyectos = 0;
    let presupuesto = 0;
    for (const fila of porEstadoFilas) {
      porEstado[fila.estado] = Number(fila.total);
      totalProyectos += Number(fila.total);
      presupuesto += Number(fila.presupuesto);
    }

    const tecnicos = await this.consultaVisible(usuario)
      .select('COUNT(DISTINCT pe.usuario_id)', 'total')
      .innerJoin('proyecto_equipo', 'pe', 'pe.proyecto_id = p.id AND pe.retirado_at IS NULL')
      .getRawOne<{ total: string }>();

    return {
      totalProyectos,
      porEstado,
      presupuestoBob: normalizarMonto(presupuesto.toFixed(2)),
      tecnicosActivos: Number(tecnicos?.total ?? 0),
    };
  }

  /** Proyectos que el usuario puede ver: todos, o solo los asignados si es Técnico. */
  private consultaVisible(usuario: UsuarioAutenticado): SelectQueryBuilder<Proyecto> {
    const qb = this.proyectos.createQueryBuilder('p');
    if (usuario.rol === RolUsuario.TECNICO) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM proyecto_equipo pv
                  WHERE pv.proyecto_id = p.id AND pv.usuario_id = :usuarioId AND pv.retirado_at IS NULL)`,
        { usuarioId: usuario.id },
      );
    }
    return qb;
  }

  async obtenerPorId(id: string): Promise<Proyecto> {
    const proyecto = await this.proyectos.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!proyecto) throw new NotFoundException('El proyecto no existe.');
    return proyecto;
  }

  async actualizarEstado(id: string, dto: UpdateEstadoProyectoDto): Promise<Proyecto> {
    const proyecto = await this.obtenerPorId(id);

    if (proyecto.estado === dto.estado) return proyecto;

    // RN-09: CERRADO es estado terminal
    if (proyecto.estado === 'CERRADO') {
      throw new UnprocessableEntityException(
        'Un proyecto cerrado no puede cambiar de estado (RN-09).',
      );
    }

    const clave = `${proyecto.estado}>${dto.estado}`;
    if (!TRANSICIONES_PERMITIDAS.has(clave)) {
      throw new UnprocessableEntityException(
        `Transición de proyecto no permitida: ${proyecto.estado} -> ${dto.estado}`,
      );
    }

    const anterior = proyecto.estado;
    proyecto.estado = dto.estado;
    try {
      return await this.proyectos.save(proyecto);
    } catch (e) {
      if (this.esTransicionRechazada(e)) {
        proyecto.estado = anterior;
        throw new UnprocessableEntityException(
          `Transición de proyecto no permitida: ${anterior} -> ${dto.estado}`,
        );
      }
      throw e;
    }
  }

  /** RF-02 / CP-02 / SGP-7: registra el presupuesto total aprobado con su moneda. */
  async registrarPresupuesto(id: string, dto: RegistrarPresupuestoDto): Promise<Proyecto> {
    const proyecto = await this.obtenerPorId(id);

    // RN-09: un proyecto cerrado es de solo lectura
    if (proyecto.estado === 'CERRADO') {
      throw new UnprocessableEntityException(
        'No se puede modificar el presupuesto de un proyecto cerrado (RN-09).',
      );
    }

    proyecto.presupuestoTotal = normalizarMonto(dto.monto);
    proyecto.moneda = dto.moneda;
    return this.proyectos.save(proyecto);
  }

  private esCodigoDuplicado(e: unknown): boolean {
    if (!(e instanceof QueryFailedError)) return false;
    const driver = e.driverError as { code?: string; constraint?: string } | undefined;
    return driver?.code === PG_UNIQUE_VIOLATION && (driver.constraint?.includes('codigo') ?? true);
  }

  private esTransicionRechazada(e: unknown): boolean {
    if (!(e instanceof QueryFailedError)) return false;
    const driver = e.driverError as { code?: string; message?: string } | undefined;
    return (
      driver?.code === PG_CHECK_VIOLATION &&
      (driver.message?.includes('Transición de proyecto no permitida') ?? false)
    );
  }
}