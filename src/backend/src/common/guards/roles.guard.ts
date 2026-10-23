import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UsuarioAutenticado } from '../../modules/auth/types/auth.types';
import { RolUsuario } from '../../modules/proyectos/entities/usuario.entity';
import { ROLES_PERMITIDOS } from '../decorators/roles.decorator';

/** Guard global: si la ruta declara @Roles, el rol del usuario debe estar en la lista (403 si no). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<RolUsuario[] | undefined>(ROLES_PERMITIDOS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const usuario = context.switchToHttp().getRequest<{ user?: UsuarioAutenticado }>().user;
    if (usuario && roles.includes(usuario.rol)) return true;
    throw new ForbiddenException('Tu rol no tiene permiso para esta operación.');
  }
}