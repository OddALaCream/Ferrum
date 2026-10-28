import { Body, Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UsuarioActual } from '../../../common/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../auth/types/auth.types';
import { RolUsuario } from '../../proyectos/entities/usuario.entity';
import { AlcanceProyecto } from '../../proyectos/guards/alcance-proyecto.guard';
import { CrearTareaDto, EditarTareaDto } from '../dto/tarea.dto';
import { TareasService } from '../services/tareas.service';

/** Tareas de una actividad: las gestiona el Administrador o el técnico responsable de la actividad. */
@ApiTags('Tareas')
@Roles(RolUsuario.ADMINISTRADOR, RolUsuario.TECNICO)
@AlcanceProyecto('proyectoId')
@Controller('proyectos/:proyectoId')
export class TareasController {
  constructor(private readonly tareas: TareasService) {}

  @Post('actividades/:actividadId/tareas')
  crear(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('actividadId', ParseUUIDPipe) actividadId: string,
    @Body() dto: CrearTareaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.tareas.crear(proyectoId, actividadId, dto, usuario);
  }

  @Patch('tareas/:tareaId')
  editar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('tareaId', ParseUUIDPipe) tareaId: string,
    @Body() dto: EditarTareaDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.tareas.editar(proyectoId, tareaId, dto, usuario);
  }

  @Delete('tareas/:tareaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('tareaId', ParseUUIDPipe) tareaId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.tareas.eliminar(proyectoId, tareaId, usuario);
  }
}