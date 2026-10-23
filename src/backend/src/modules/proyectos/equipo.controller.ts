import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { AsignarTecnicoDto } from './dto/asignar-tecnico.dto';
import { RolUsuario } from './entities/usuario.entity';
import { EquipoService } from './equipo.service';
import { AlcanceProyecto } from './guards/alcance-proyecto.guard';

@Controller('proyectos/:proyectoId/equipo')
export class EquipoController {
  constructor(private readonly equipoService: EquipoService) {}

  /** Ver el equipo: Administrador, Supervisor y los técnicos del propio proyecto. */
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.SUPERVISOR, RolUsuario.TECNICO)
  @AlcanceProyecto('proyectoId')
  @Get()
  listar(@Param('proyectoId', ParseUUIDPipe) proyectoId: string) {
    return this.equipoService.listar(proyectoId);
  }

  /** Debe declararse antes de rutas con `:usuarioId` para no capturar "disponibles" como UUID. */
  @Roles(RolUsuario.ADMINISTRADOR)
  @Get('disponibles')
  disponibles(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Query('q') q?: string,
  ) {
    return this.equipoService.buscarDisponibles(proyectoId, q ?? '');
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post()
  asignar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Body() dto: AsignarTecnicoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.equipoService.asignar(proyectoId, dto.usuarioId, usuario.id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete(':usuarioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async retirar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
  ): Promise<void> {
    await this.equipoService.retirar(proyectoId, usuarioId);
  }
}