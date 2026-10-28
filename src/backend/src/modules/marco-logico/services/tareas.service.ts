import { ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { UsuarioAutenticado } from '../../auth/types/auth.types';
import { Proyecto } from '../../proyectos/entities/proyecto.entity';
import { ProyectoEquipo } from '../../proyectos/entities/proyecto-equipo.entity';
import { RolUsuario } from '../../proyectos/entities/usuario.entity';
import { CrearTareaDto, EditarTareaDto } from '../dto/tarea.dto';
import { Actividad } from '../entities/actividad.entity';
import { Tarea } from '../entities/tarea.entity';
import { esFechaValida } from '../utils/estado-efectivo';
import { ActividadesService } from './actividades.service';

/**
 * RF-24: tareas en que se subdivide una actividad ("hablar con los jefes de manzana", "hacer encuestas"…).
 * Las crea el Administrador o el técnico responsable de la actividad; también ellos las actualizan.
 */
@Injectable()
export class TareasService {
  constructor(
    @InjectRepository(Proyecto) private readonly proyectos: Repository<Proyecto>,
    @InjectRepository(Tarea) private readonly tareas: Repository<Tarea>,
    @InjectRepository(Actividad) private readonly actividades: Repository<Actividad>,
    @InjectRepository(ProyectoEquipo) private readonly equipo: Repository<ProyectoEquipo>,
    private readonly actividadesService: ActividadesService,
  ) {}

  async crear(proyectoId: string, actividadId: string, dto: CrearTareaDto, usuario: UsuarioAutenticado): Promise<Tarea> {
    await this.proyectoEditable(proyectoId);
    const a = await this.actividadesService.actividad(proyectoId, actividadId);
    this.verificarPermiso(usuario, a);
    if (dto.fechaLimite && !esFechaValida(dto.fechaLimite)) throw new UnprocessableEntityException('La fecha límite no es válida.');
    if (dto.responsableId) await this.validarResponsable(proyectoId, dto.responsableId);
    return this.tareas.save(this.tareas.create({ ...dto, actividadId }));
  }

  async editar(proyectoId: string, tareaId: string, dto: EditarTareaDto, usuario: UsuarioAutenticado): Promise<Tarea> {
    await this.proyectoEditable(proyectoId);
    const { tarea, actividad } = await this.tarea(proyectoId, tareaId);
    this.verificarPermiso(usuario, actividad);
    if (dto.fechaLimite && !esFechaValida(dto.fechaLimite)) throw new UnprocessableEntityException('La fecha límite no es válida.');
    if (dto.responsableId) await this.validarResponsable(proyectoId, dto.responsableId);

    Object.assign(tarea, dto);
    if (dto.estado) tarea.cerradoAt = dto.estado === 'COMPLETADA' ? (tarea.cerradoAt ?? new Date()) : null;
    return this.tareas.save(tarea);
  }

  async eliminar(proyectoId: string, tareaId: string, usuario: UsuarioAutenticado): Promise<void> {
    await this.proyectoEditable(proyectoId);
    const { tarea, actividad } = await this.tarea(proyectoId, tareaId);
    this.verificarPermiso(usuario, actividad);
    await this.tareas.delete(tarea.id);
  }

  private verificarPermiso(usuario: UsuarioAutenticado, a: Actividad): void {
    const esAdmin = usuario.rol === RolUsuario.ADMINISTRADOR;
    const esResponsable = usuario.rol === RolUsuario.TECNICO && a.responsableId === usuario.id;
    if (!esAdmin && !esResponsable) {
      throw new ForbiddenException('Solo el Administrador o el técnico responsable de la actividad puede gestionar sus tareas.');
    }
  }

  private async validarResponsable(proyectoId: string, usuarioId: string): Promise<void> {
    const miembro = await this.equipo.findOne({
      where: { proyectoId, usuarioId, retiradoAt: IsNull() },
      relations: { usuario: true },
    });
    if (!miembro || miembro.usuario.rol !== RolUsuario.TECNICO || !miembro.usuario.activo) {
      throw new UnprocessableEntityException('El responsable debe ser un técnico activo del equipo del proyecto.');
    }
  }

  private async proyectoEditable(proyectoId: string): Promise<void> {
    const p = await this.proyectos.findOne({ where: { id: proyectoId } });
    if (!p) throw new NotFoundException('El proyecto no existe.');
    if (p.estado === 'CERRADO') throw new UnprocessableEntityException('Un proyecto cerrado no admite cambios en su marco lógico (RN-09).');
  }

  private async tarea(proyectoId: string, tareaId: string): Promise<{ tarea: Tarea; actividad: Actividad }> {
    const tarea = await this.tareas.findOne({ where: { id: tareaId } });
    if (!tarea) throw new NotFoundException('La tarea no existe.');
    const actividad = await this.actividadesService.actividad(proyectoId, tarea.actividadId);
    return { tarea, actividad };
  }
}