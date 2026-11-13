import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { AsignarSupervisorDto } from './dto/asignar-supervisor.dto';
import { RolUsuario } from './entities/usuario.entity';
import { AlcanceProyecto } from './guards/alcance-proyecto.guard';
import { SupervisoresService } from './supervisores.service';

@ApiTags('Supervisión del proyecto')
@Controller('proyectos/:proyectoId/supervisores')
export class SupervisoresController {
  constructor(private readonly supervisores: SupervisoresService) {}

  /** Quién supervisa el proyecto: lo ve quien tiene acceso al proyecto. */
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.SUPERVISOR, RolUsuario.TECNICO)
  @AlcanceProyecto('proyectoId')
  @Get()
  listar(@Param('proyectoId', ParseUUIDPipe) proyectoId: string) {
    return this.supervisores.listar(proyectoId);
  }

  /** Debe declararse antes de rutas con `:usuarioId` para no capturar "disponibles" como UUID. */
  @Roles(RolUsuario.ADMINISTRADOR)
  @Get('disponibles')
  disponibles(@Param('proyectoId', ParseUUIDPipe) proyectoId: string, @Query('q') q?: string) {
    return this.supervisores.buscarDisponibles(proyectoId, q ?? '');
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post()
  asignar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Body() dto: AsignarSupervisorDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.supervisores.asignar(proyectoId, dto.usuarioId, usuario.id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete(':usuarioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async retirar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
  ): Promise<void> {
    await this.supervisores.retirar(proyectoId, usuarioId);
  }
}