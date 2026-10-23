import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { DIRECTOR_SEED_ID } from './constants';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { RegistrarPresupuestoDto } from './dto/registrar-presupuesto.dto';
import { UpdateEstadoProyectoDto } from './dto/update-estado-proyecto.dto';
import { Financiador } from './entities/financiador.entity';
import { Proyecto } from './entities/proyecto.entity';
import { normalizarMonto } from './presupuesto';

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
    @InjectRepository(Financiador)
    private readonly financiadores: Repository<Financiador>,
  ) {}

  async crear(dto: CreateProyectoDto): Promise<Proyecto> {
    const financiador = await this.financiadores.findOne({
      where: { id: dto.financiadorId, activo: true },
    });
    if (!financiador) {
      throw new NotFoundException('El financiador indicado no existe o no está activo.');
    }

    const proyecto = this.proyectos.create({
      codigo: dto.codigo.trim(),
      nombre: dto.nombre.trim(),
      financiadorId: dto.financiadorId,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      estado: 'PLANIFICACION',
      presupuestoTotal: '0.00',
      moneda: 'BOB',
      creadoPorId: DIRECTOR_SEED_ID,
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
