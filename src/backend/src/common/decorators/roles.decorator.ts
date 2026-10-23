import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '../../modules/proyectos/entities/usuario.entity';

export const ROLES_PERMITIDOS = 'rolesPermitidos';

/** Restringe una ruta a los roles indicados. Sin @Roles, basta con estar autenticado. */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_PERMITIDOS, roles);