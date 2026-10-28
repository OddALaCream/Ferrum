import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import type { UsuarioAutenticado } from '../../auth/types/auth.types';
import { Proyecto } from '../../proyectos/entities/proyecto.entity';
import { ProyectoEquipo } from '../../proyectos/entities/proyecto-equipo.entity';
import { RolUsuario } from '../../proyectos/entities/usuario.entity';
import { CambiarEstadoActividadDto, CrearActividadDto, EditarActividadDto } from '../dto/actividad.dto';
import { Actividad } from '../entities/actividad.entity';
import { ActividadSesion } from '../entities/actividad-sesion.entity';
import { Iov } from '../entities/iov.entity';
import { Resultado } from '../entities/resultado.entity';
import { codigoPg, esViolacionFk } from '../utils/errores-pg';
import { esFechaValida } from '../utils/estado-efectivo';

const MSG_DUPLICADA = 'Ya existe una actividad con ese código en el resultado.';

/**
 * RF-08, RF-09, RF-13 y RF-25: actividades de un resultado, con su cronograma y su técnico responsable.
 * - CONTINUA: corre de la fecha de inicio a la de fin; el técnico indica su avance o la completa.
 * - DISCRETA: ocurre en sesiones puntuales; el técnico solo marca cada sesión como realizada.
 */
@Injectable()
export class ActividadesService {
  constructor(
    @InjectRepository(Proyecto) private readonly proyectos: Repository<Proyecto>,
    @InjectRepository(Resultado) private readonly resultados: Repository<Resultado>,
    @InjectRepository(Iov) private readonly indicadores: Repository<Iov>,
    @InjectRepository(Actividad) private readonly actividades: Repository<Actividad>,
    @InjectRepository(ActividadSesion) private readonly sesiones: Repository<ActividadSesion>,
    @InjectRepository(ProyectoEquipo) private readonly equipo: Repository<ProyectoEquipo>,
  ) {}

  async crear(proyectoId: string, resultadoId: string, dto: CrearActividadDto): Promise<Actividad> {
    const proyecto = await this.proyectoEditable(proyectoId);
    const resultado = await this.resultados.findOne({ where: { id: resultadoId, proyectoId } });
    if (!resultado) throw new NotFoundException('El resultado no existe en este proyecto.');

    this.validarFechas(dto.fechaInicio, dto.fechaFin, proyecto);
    if (dto.responsableId) await this.validarResponsable(proyectoId, dto.responsableId);
    if (dto.iovId) await this.validarIndicador(resultadoId, dto.iovId);

    const sesiones = [...new Set(dto.sesiones ?? [])].sort();
    if (dto.tipoCronograma === 'CONTINUO' && sesiones.length > 0) {
      throw new BadRequestException('Una actividad continua no lleva sesiones; solo las actividades discretas.');
    }
    this.validarSesiones(sesiones, dto.fechaInicio, dto.fechaFin);

    const datos: Partial<CrearActividadDto> = { ...dto };
    delete datos.sesiones;
    try {
      const actividad = await this.actividades.save(Object.assign(new Actividad(), datos, { resultadoId }));
      if (sesiones.length) {
        await this.sesiones.insert(sesiones.map((fecha) => ({ actividadId: actividad.id, fecha })));
      }
      return actividad;
    } catch (e) {
      if (codigoPg(e) === '23505') throw new ConflictException(MSG_DUPLICADA);
      throw e;
    }
  }

  async editar(proyectoId: string, actividadId: string, dto: EditarActividadDto): Promise<Actividad> {
    const proyecto = await this.proyectoEditable(proyectoId);
    const a = await this.actividad(proyectoId, actividadId);

    Object.assign(a, dto);
    this.validarFechas(a.fechaInicio, a.fechaFin, proyecto);
    if (dto.responsableId) await this.validarResponsable(proyectoId, dto.responsableId);
    if (dto.iovId) await this.validarIndicador(a.resultadoId, dto.iovId);
    if (a.tipoCronograma === 'DISCRETO') {
      const existentes = await this.sesiones.find({ where: { actividadId } });
      this.validarSesiones(existentes.map((s) => s.fecha), a.fechaInicio, a.fechaFin);
    }
    try {
      return await this.actividades.save(a);
    } catch (e) {
      if (codigoPg(e) === '23505') throw new ConflictException(MSG_DUPLICADA);
      throw e;
    }
  }

  async eliminar(proyectoId: string, actividadId: string): Promise<void> {
    await this.proyectoEditable(proyectoId);
    const a = await this.actividad(proyectoId, actividadId);
    try {
      await this.actividades.delete(a.id);
    } catch (e) {
      if (esViolacionFk(e)) {
        throw new ConflictException('No se puede eliminar la actividad: tiene tareas o avances asociados.');
      }
      throw e;
    }
  }

  /** Administrador: agrega fechas a una actividad discreta. */
  async agregarSesiones(proyectoId: string, actividadId: string, fechas: string[]): Promise<ActividadSesion[]> {
    await this.proyectoEditable(proyectoId);
    const a = await this.actividad(proyectoId, actividadId);
    if (a.tipoCronograma !== 'DISCRETO') {
      throw new UnprocessableEntityException('Solo las actividades discretas tienen sesiones.');
    }
    const nuevas = [...new Set(fechas)].sort();
    this.validarSesiones(nuevas, a.fechaInicio, a.fechaFin);
    const ya = new Set((await this.sesiones.find({ where: { actividadId } })).map((s) => s.fecha));
    const repetidas = nuevas.filter((f) => ya.has(f));
    if (repetidas.length) throw new ConflictException(`Ya hay una sesión el ${repetidas.join(', ')}.`);

    await this.sesiones.insert(nuevas.map((fecha) => ({ actividadId, fecha })));
    await this.recalcular(a);
    return this.sesiones.find({ where: { actividadId }, order: { fecha: 'ASC' } });
  }

  /** El técnico responsable (o el Administrador) marca si la sesión ya se realizó. */
  async marcarSesion(
    proyectoId: string,
    actividadId: string,
    sesionId: string,
    realizada: boolean,
    usuario: UsuarioAutenticado,
  ): Promise<Actividad> {
    await this.proyectoEditable(proyectoId);
    const a = await this.actividad(proyectoId, actividadId);
    this.verificarPermiso(usuario, a);
    const s = await this.sesiones.findOne({ where: { id: sesionId, actividadId } });
    if (!s) throw new NotFoundException('La sesión no existe en esta actividad.');

    await this.sesiones.update(s.id, {
      realizada,
      realizadaAt: realizada ? new Date() : null,
      realizadaPor: realizada ? usuario.id : null,
    });
    return this.recalcular(a);
  }

  /** El técnico responsable (o el Administrador) actualiza el estado y el avance de una actividad continua. */
  async cambiarEstado(
    proyectoId: string,
    actividadId: string,
    dto: CambiarEstadoActividadDto,
    usuario: UsuarioAutenticado,
  ): Promise<Actividad> {
    await this.proyectoEditable(proyectoId);
    const a = await this.actividad(proyectoId, actividadId);
    this.verificarPermiso(usuario, a);
    if (a.tipoCronograma === 'DISCRETO') {
      throw new UnprocessableEntityException('El avance de una actividad discreta se marca sesión por sesión.');
    }

    let pct = dto.cumplimientoPct ?? a.cumplimientoPct;
    let estado = dto.estado;
    if (estado === 'COMPLETADA') pct = 100;
    else if (pct >= 100) estado = 'COMPLETADA';
    else if (estado === 'PENDIENTE') pct = 0;

    a.estado = estado;
    a.cumplimientoPct = pct;
    return this.actividades.save(a);
  }

  /** Estado y % de una actividad discreta a partir de sus sesiones realizadas. */
  private async recalcular(a: Actividad): Promise<Actividad> {
    const todas = await this.sesiones.find({ where: { actividadId: a.id } });
    const hechas = todas.filter((s) => s.realizada).length;
    a.cumplimientoPct = todas.length ? Math.round((hechas / todas.length) * 10000) / 100 : 0;
    a.estado = todas.length > 0 && hechas === todas.length ? 'COMPLETADA' : hechas > 0 ? 'EN_CURSO' : 'PENDIENTE';
    return this.actividades.save(a);
  }

  private verificarPermiso(usuario: UsuarioAutenticado, a: Actividad): void {
    const esAdmin = usuario.rol === RolUsuario.ADMINISTRADOR;
    const esResponsable = usuario.rol === RolUsuario.TECNICO && a.responsableId === usuario.id;
    if (!esAdmin && !esResponsable) {
      throw new ForbiddenException('Solo el Administrador o el técnico responsable de la actividad puede actualizarla.');
    }
  }

  private validarFechas(inicio: string, fin: string, proyecto: Proyecto): void {
    if (!esFechaValida(inicio) || !esFechaValida(fin)) throw new BadRequestException('Las fechas no son válidas.');
    if (fin < inicio) throw new BadRequestException('La fecha de fin no puede ser anterior a la de inicio.');
    if (inicio < proyecto.fechaInicio || fin > proyecto.fechaFin) {
      throw new UnprocessableEntityException(
        `Las fechas deben estar dentro del periodo del proyecto (${proyecto.fechaInicio} a ${proyecto.fechaFin}).`,
      );
    }
  }

  private validarSesiones(fechas: string[], inicio: string, fin: string): void {
    for (const f of fechas) {
      if (!esFechaValida(f)) throw new BadRequestException(`La sesión "${f}" no es una fecha válida.`);
      if (f < inicio || f > fin) {
        throw new UnprocessableEntityException(`La sesión del ${f} está fuera del cronograma de la actividad (${inicio} a ${fin}).`);
      }
    }
  }

  /** CP-25: solo un técnico vigente del equipo puede ser responsable. */
  private async validarResponsable(proyectoId: string, usuarioId: string): Promise<void> {
    const miembro = await this.equipo.findOne({
      where: { proyectoId, usuarioId, retiradoAt: IsNull() },
      relations: { usuario: true },
    });
    if (!miembro || miembro.usuario.rol !== RolUsuario.TECNICO || !miembro.usuario.activo) {
      throw new UnprocessableEntityException('El responsable debe ser un técnico activo del equipo del proyecto.');
    }
  }

  private async validarIndicador(resultadoId: string, iovId: string): Promise<void> {
    const ok = await this.indicadores.exists({ where: { id: iovId, resultadoId } });
    if (!ok) throw new UnprocessableEntityException('El indicador debe pertenecer al mismo resultado que la actividad.');
  }

  private async proyectoEditable(proyectoId: string): Promise<Proyecto> {
    const p = await this.proyectos.findOne({ where: { id: proyectoId } });
    if (!p) throw new NotFoundException('El proyecto no existe.');
    if (p.estado === 'CERRADO') throw new UnprocessableEntityException('Un proyecto cerrado no admite cambios en su marco lógico (RN-09).');
    return p;
  }

  /** Actividad que pertenece al proyecto (a través de su resultado). */
  async actividad(proyectoId: string, actividadId: string): Promise<Actividad> {
    const resultados = await this.resultados.find({ where: { proyectoId }, select: { id: true } });
    const a = await this.actividades.findOne({
      where: { id: actividadId, resultadoId: In(resultados.map((r) => r.id)) },
    });
    if (!a) throw new NotFoundException('La actividad no existe en este proyecto.');
    return a;
  }
}