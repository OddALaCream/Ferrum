import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { ProyectoEquipo } from './entities/proyecto-equipo.entity';
import { Proyecto } from './entities/proyecto.entity';
import { RolUsuario, Usuario } from './entities/usuario.entity';

export interface TecnicoProyectoDto {
  id: string;
  nombre: string;
  email: string;
  fechaAsignacion: string;
}

export interface TecnicoDisponibleDto {
  id: string;
  nombre: string;
  email: string;
}

const PG_UNIQUE_VIOLATION = '23505';
const PG_CHECK_VIOLATION = '23514';

@Injectable()
export class EquipoService {
  constructor(
    @InjectRepository(ProyectoEquipo)
    private readonly equipo: Repository<ProyectoEquipo>,
    @InjectRepository(Proyecto)
    private readonly proyectos: Repository<Proyecto>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
  ) {}

  async listar(proyectoId: string): Promise<TecnicoProyectoDto[]> {
    await this.asegurarProyecto(proyectoId);

    const filas = await this.equipo.find({
      where: { proyectoId, retiradoAt: IsNull() },
      relations: { usuario: true },
      order: { asignadoAt: 'ASC' },
    });

    return filas.map((f) => this.aDto(f));
  }

  async buscarDisponibles(proyectoId: string, q = ''): Promise<TecnicoDisponibleDto[]> {
    await this.asegurarProyecto(proyectoId);

    const qb = this.usuarios
      .createQueryBuilder('u')
      .where('u.rol = :rol', { rol: RolUsuario.TECNICO })
      .andWhere('u.activo = true')
      .andWhere('u.deleted_at IS NULL')
      .andWhere(
        `u.id NOT IN (
          SELECT pe.usuario_id FROM proyecto_equipo pe
           WHERE pe.proyecto_id = :proyectoId AND pe.retirado_at IS NULL
        )`,
        { proyectoId },
      )
      .orderBy('u.nombre', 'ASC')
      .select(['u.id', 'u.nombre', 'u.email']);

    const consulta = q.trim();
    if (consulta) {
      qb.andWhere('(u.nombre ILIKE :q OR u.email ILIKE :q)', { q: `%${consulta}%` });
    }

    const tecnicos = await qb.getMany();
    return tecnicos.map((t) => ({ id: t.id, nombre: t.nombre, email: t.email }));
  }

  /** `asignadoPorId`: el Administrador de la sesión que hace la asignación. */
  async asignar(proyectoId: string, usuarioId: string, asignadoPorId: string): Promise<TecnicoProyectoDto> {
    await this.asegurarProyecto(proyectoId);

    const tecnico = await this.usuarios.findOne({
      where: { id: usuarioId, rol: RolUsuario.TECNICO, activo: true, deletedAt: IsNull() },
    });
    if (!tecnico) {
      throw new NotFoundException('El técnico no existe, no está activo o no tiene rol TECNICO.');
    }

    const activo = await this.equipo.findOne({
      where: { proyectoId, usuarioId, retiradoAt: IsNull() },
    });
    if (activo) {
      throw new ConflictException('El técnico ya está asignado al proyecto.');
    }

    const asignacion = this.equipo.create({
      proyectoId,
      usuarioId,
      asignadoPorId,
    });

    try {
      const guardada = await this.equipo.save(asignacion);
      const completa = await this.equipo.findOne({
        where: { id: guardada.id },
        relations: { usuario: true },
      });
      if (!completa) throw new NotFoundException('No se pudo leer la asignación creada.');
      return this.aDto(completa);
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      if (this.esAsignacionDuplicada(e)) {
        throw new ConflictException('El técnico ya está asignado al proyecto.');
      }
      if (this.esReglaEquipo(e)) {
        const driver = (e as QueryFailedError).driverError as { message?: string } | undefined;
        throw new UnprocessableEntityException(
          driver?.message ?? 'Solo los usuarios con rol TECNICO pueden asignarse a un proyecto',
        );
      }
      throw e;
    }
  }

  async retirar(proyectoId: string, usuarioId: string): Promise<void> {
    await this.asegurarProyecto(proyectoId);

    const activa = await this.equipo.findOne({
      where: { proyectoId, usuarioId, retiradoAt: IsNull() },
    });
    if (!activa) {
      throw new NotFoundException('El técnico no está asignado al proyecto.');
    }

    activa.retiradoAt = new Date();
    await this.equipo.save(activa);
  }

  private async asegurarProyecto(proyectoId: string): Promise<void> {
    const existe = await this.proyectos.exists({ where: { id: proyectoId, deletedAt: IsNull() } });
    if (!existe) throw new NotFoundException('El proyecto no existe.');
  }

  private aDto(fila: ProyectoEquipo): TecnicoProyectoDto {
    return {
      id: fila.usuarioId,
      nombre: fila.usuario.nombre,
      email: fila.usuario.email,
      fechaAsignacion: fila.asignadoAt.toISOString(),
    };
  }

  private esAsignacionDuplicada(e: unknown): boolean {
    if (!(e instanceof QueryFailedError)) return false;
    const driver = e.driverError as { code?: string; constraint?: string } | undefined;
    return driver?.code === PG_UNIQUE_VIOLATION && (driver.constraint?.includes('equipo') ?? false);
  }

  private esReglaEquipo(e: unknown): boolean {
    if (!(e instanceof QueryFailedError)) return false;
    const driver = e.driverError as { code?: string; message?: string } | undefined;
    return driver?.code === PG_CHECK_VIOLATION && (driver.message?.includes('TECNICO') ?? false);
  }
}