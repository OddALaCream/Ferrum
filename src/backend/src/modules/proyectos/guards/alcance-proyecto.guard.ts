import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { UsuarioAutenticado } from '../../auth/types/auth.types';
import { ProyectoEquipo } from '../entities/proyecto-equipo.entity';
import { RolUsuario } from '../entities/usuario.entity';

const PARAM_PROYECTO = 'paramProyecto';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * SGP-50 / RN-10 / CP-23: un Técnico solo puede operar en los proyectos donde está asignado.
 * Administrador y Supervisor no se ven afectados. Se consulta la base en cada petición,
 * así que al retirar a un técnico su siguiente acceso ya recibe 403.
 */
@Injectable()
export class AlcanceProyectoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(ProyectoEquipo) private readonly equipo: Repository<ProyectoEquipo>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<{ user?: UsuarioAutenticado; params: Record<string, string | undefined> }>();
    if (req.user?.rol !== RolUsuario.TECNICO) return true;

    const param = this.reflector.get<string>(PARAM_PROYECTO, context.getHandler()) ?? 'id';
    const proyectoId = req.params[param];
    // Un id mal formado lo rechaza después el ParseUUIDPipe con 400
    if (!proyectoId || !UUID.test(proyectoId)) return true;

    const asignado = await this.equipo.exists({
      where: { proyectoId, usuarioId: req.user.id, retiradoAt: IsNull() },
    });
    if (!asignado) throw new ForbiddenException('No estás asignado a este proyecto.');
    return true;
  }
}

/** Aplica el AlcanceProyectoGuard leyendo el id del proyecto del parámetro de ruta indicado. */
export const AlcanceProyecto = (param = 'id') =>
  applyDecorators(SetMetadata(PARAM_PROYECTO, param), UseGuards(AlcanceProyectoGuard));