import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UsuarioActual } from '../../../common/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../auth/types/auth.types';
import { RolUsuario } from '../../proyectos/entities/usuario.entity';
import { SeguimientoService } from '../services/seguimiento.service';

/** Datos para los paneles de cada rol. Cada uno recibe solo lo que le corresponde ver. */
@ApiTags('Seguimiento')
@Controller('seguimiento')
export class SeguimientoController {
  constructor(private readonly seguimiento: SeguimientoService) {}

  /** Actividades retrasadas: todas (Administrador), las de sus proyectos (Supervisor) o las suyas (Técnico). */
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.SUPERVISOR, RolUsuario.TECNICO)
  @Get('retrasadas')
  retrasadas(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.seguimiento.retrasadas(usuario);
  }

  /** Panel del Técnico: sus actividades y tareas pendientes. */
  @Roles(RolUsuario.TECNICO)
  @Get('mi-trabajo')
  miTrabajo(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.seguimiento.miTrabajo(usuario);
  }
}