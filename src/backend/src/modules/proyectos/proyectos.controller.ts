import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { RegistrarPresupuestoDto } from './dto/registrar-presupuesto.dto';
import { UpdateEstadoProyectoDto } from './dto/update-estado-proyecto.dto';
import { Proyecto } from './entities/proyecto.entity';
import { RolUsuario } from './entities/usuario.entity';
import { AlcanceProyecto } from './guards/alcance-proyecto.guard';
import { ProyectosService } from './proyectos.service';

@Controller('proyectos')
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post()
  crear(@Body() dto: CreateProyectoDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.proyectosService.crear(dto, usuario.id);
  }

  /** El Técnico solo ve los proyectos donde está asignado (SGP-50). */
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.SUPERVISOR, RolUsuario.TECNICO)
  @AlcanceProyecto()
  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.proyectosService.obtenerPorId(id);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch(':id/estado')
  actualizarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEstadoProyectoDto,
  ) {
    return this.proyectosService.actualizarEstado(id, dto);
  }

  /**
   * RF-02 / SGP-7: registra el presupuesto total aprobado del proyecto. Solo el Administrador.
   */
  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch(':id/presupuesto')
  registrarPresupuesto(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RegistrarPresupuestoDto,
  ): Promise<Proyecto> {
    return this.proyectosService.registrarPresupuesto(id, dto);
  }
}