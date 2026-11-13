import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { ProyectoSupervisor } from './entities/proyecto-supervisor.entity';
import { Proyecto } from './entities/proyecto.entity';
import { RolUsuario, Usuario } from './entities/usuario.entity';

export interface SupervisorProyectoDto {
  id: string;
  nombre: string;
  email: string;
  fechaAsignacion: string;
}

export interface SupervisorDisponibleDto {
  id: string;
  nombre: string;
  email: string;
}

const PG_UNIQUE_VIOLATION = '23505';
const PG_CHECK_VIOLATION = '23514';

/**
 * Supervisión de proyectos. El Administrador asigna y retira supervisores; un supervisor puede estar en
 * muchos proyectos y un proyecto puede tener varios supervisores. El Supervisor solo ve los suyos.
 */
@Injectable()
export class SupervisoresService {
  constructor(
    @InjectRepository(ProyectoSupervisor) private readonly supervisiones: Repository<ProyectoSupervisor>,
    @InjectRepository(Proyecto) private readonly proyectos: Repository<Proyecto>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  async listar(proyectoId: string): Promise<SupervisorProyectoDto[]> {
    await this.asegurarProyecto(proyectoId);
    const filas = await this.supervisiones.find({
      where: { proyectoId, retiradoAt: IsNull() },
      relations: { usuario: true },
      order: { asignadoAt: 'ASC' },
    });
    return filas
      .filter((f) => f.usuario && f.usuario.activo && !f.usuario.deletedAt && f.usuario.rol === RolUsuario.SUPERVISOR)
      .map((f) => this.aDto(f));
  }

  async buscarDisponibles(proyectoId: string, q = ''): Promise<SupervisorDisponibleDto[]> {
    await this.asegurarProyecto(proyectoId);
    const qb = this.usuarios
      .createQueryBuilder('u')
      .where('u.rol = :rol', { rol: RolUsuario.SUPERVISOR })
      .andWhere('u.activo = true')
      .andWhere('u.deleted_at IS NULL')
      .andWhere(
        `u.id NOT IN (SELECT ps.usuario_id FROM proyecto_supervisores ps
                       WHERE ps.proyecto_id = :proyectoId AND ps.retirado_at IS NULL)`,
        { proyectoId },
      )
      .orderBy('u.nombre', 'ASC')
      .select(['u.id', 'u.nombre', 'u.email']);

    const consulta = q.trim();
    if (consulta) qb.andWhere('(u.nombre ILIKE :q OR u.email ILIKE :q)', { q: `%${consulta}%` });

    const supervisores = await qb.getMany();
    return supervisores.map((s) => ({ id: s.id, nombre: s.nombre, email: s.email }));
  }

  /** `asignadoPorId`: el Administrador de la sesión que hace la asignación. */
  async asignar(proyectoId: string, usuarioId: string, asignadoPorId: string): Promise<SupervisorProyectoDto> {
    await this.asegurarProyecto(proyectoId);

    const supervisor = await this.usuarios.findOne({
      where: { id: usuarioId, rol: RolUsuario.SUPERVISOR, activo: true, deletedAt: IsNull() },
    });
    if (!supervisor) {
      throw new NotFoundException('El supervisor no existe, no está activo o no tiene rol SUPERVISOR.');
    }

    const yaActivo = await this.supervisiones.exists({ where: { proyectoId, usuarioId, retiradoAt: IsNull() } });
    if (yaActivo) throw new ConflictException('El supervisor ya supervisa este proyecto.');

    try {
      const guardada = await this.supervisiones.save(this.supervisiones.create({ proyectoId, usuarioId, asignadoPorId }));
      const completa = await this.supervisiones.findOne({ where: { id: guardada.id }, relations: { usuario: true } });
      if (!completa) throw new NotFoundException('No se pudo leer la asignación creada.');
      return this.aDto(completa);
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      const driver = e instanceof QueryFailedError ? (e.driverError as { code?: string; message?: string }) : undefined;
      if (driver?.code === PG_UNIQUE_VIOLATION) throw new ConflictException('El supervisor ya supervisa este proyecto.');
      if (driver?.code === PG_CHECK_VIOLATION) {
        throw new UnprocessableEntityException(driver.message ?? 'Solo los usuarios con rol SUPERVISOR pueden supervisar un proyecto');
      }
      throw e;
    }
  }

  async retirar(proyectoId: string, usuarioId: string): Promise<void> {
    await this.asegurarProyecto(proyectoId);
    const activa = await this.supervisiones.findOne({ where: { proyectoId, usuarioId, retiradoAt: IsNull() } });
    if (!activa) throw new NotFoundException('El supervisor no supervisa este proyecto.');
    activa.retiradoAt = new Date();
    await this.supervisiones.save(activa);
  }

  private async asegurarProyecto(proyectoId: string): Promise<void> {
    const existe = await this.proyectos.exists({ where: { id: proyectoId, deletedAt: IsNull() } });
    if (!existe) throw new NotFoundException('El proyecto no existe.');
  }

  private aDto(fila: ProyectoSupervisor): SupervisorProyectoDto {
    return {
      id: fila.usuarioId,
      nombre: fila.usuario.nombre,
      email: fila.usuario.email,
      fechaAsignacion: fila.asignadoAt.toISOString(),
    };
  }
}