import { Body, Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UsuarioActual } from '../../../common/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../../auth/types/auth.types';
import { RolUsuario } from '../../proyectos/entities/usuario.entity';
import { AlcanceProyecto } from '../../proyectos/guards/alcance-proyecto.guard';
import {
  AgregarSesionesDto,
  CambiarEstadoActividadDto,
  CrearActividadDto,
  EditarActividadDto,
  MarcarSesionDto,
} from '../dto/actividad.dto';
import { ActividadesService } from '../services/actividades.service';

/** Actividades de un resultado y su cronograma. El Administrador planifica; el técnico responsable anota lo cumplido. */
@ApiTags('Actividades')
@Controller('proyectos/:proyectoId')
export class ActividadesController {
  constructor(private readonly actividades: ActividadesService) {}

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('resultados/:resultadoId/actividades')
  crear(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('resultadoId', ParseUUIDPipe) resultadoId: string,
    @Body() dto: CrearActividadDto,
  ) {
    return this.actividades.crear(proyectoId, resultadoId, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch('actividades/:actividadId')
  editar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('actividadId', ParseUUIDPipe) actividadId: string,
    @Body() dto: EditarActividadDto,
  ) {
    return this.actividades.editar(proyectoId, actividadId, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete('actividades/:actividadId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('actividadId', ParseUUIDPipe) actividadId: string,
  ): Promise<void> {
    await this.actividades.eliminar(proyectoId, actividadId);
  }

  /** Actividad continua: el técnico responsable indica su estado y avance. */
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.TECNICO)
  @AlcanceProyecto('proyectoId')
  @Patch('actividades/:actividadId/estado')
  cambiarEstado(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('actividadId', ParseUUIDPipe) actividadId: string,
    @Body() dto: CambiarEstadoActividadDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.actividades.cambiarEstado(proyectoId, actividadId, dto, usuario);
  }

  /** Actividad discreta: agrega fechas puntuales (talleres, reuniones…). */
  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('actividades/:actividadId/sesiones')
  agregarSesiones(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('actividadId', ParseUUIDPipe) actividadId: string,
    @Body() dto: AgregarSesionesDto,
  ) {
    return this.actividades.agregarSesiones(proyectoId, actividadId, dto.fechas);
  }

  /** Actividad discreta: el técnico responsable marca si la sesión ya se realizó. */
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.TECNICO)
  @AlcanceProyecto('proyectoId')
  @Patch('actividades/:actividadId/sesiones/:sesionId')
  marcarSesion(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('actividadId', ParseUUIDPipe) actividadId: string,
    @Param('sesionId', ParseUUIDPipe) sesionId: string,
    @Body() dto: MarcarSesionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.actividades.marcarSesion(proyectoId, actividadId, sesionId, dto.realizada, usuario);
  }
}