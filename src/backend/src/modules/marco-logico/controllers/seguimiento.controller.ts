import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UsuarioActual } from '../../../common/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../auth/types/auth.types';
import { RolUsuario } from '../../proyectos/entities/usuario.entity';
import { ProcesoRetrasosService } from '../services/proceso-retrasos.service';
import { SeguimientoService } from '../services/seguimiento.service';

/** Datos para los paneles de cada rol. Cada uno recibe solo lo que le corresponde ver. */
@ApiTags('Seguimiento')
@Controller('seguimiento')
export class SeguimientoController {
  constructor(
    private readonly seguimiento: SeguimientoService,
    private readonly procesoRetrasos: ProcesoRetrasosService,
  ) {}

  /** Actividades retrasadas: todas (Administrador), las de sus proyectos (Supervisor) o las suyas (Técnico). */
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.SUPERVISOR, RolUsuario.TECNICO)
  @Get('retrasadas')
  retrasadas(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.seguimiento.retrasadas(usuario);
  }

  /** Lanza ahora la revisión diaria de retrasos (corre sola cada día a las 00:05). Solo el Administrador. */
  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('marcar-retrasadas')
  @HttpCode(HttpStatus.OK)
  marcarRetrasadas() {
    return this.procesoRetrasos.ejecutar();
  }

  /** Panel del Técnico: sus actividades y tareas pendientes. */
  @Roles(RolUsuario.TECNICO)
  @Get('mi-trabajo')
  miTrabajo(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.seguimiento.miTrabajo(usuario);
  }
}