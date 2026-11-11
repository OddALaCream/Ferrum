import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolUsuario } from '../proyectos/entities/usuario.entity';
import { AlcanceProyecto } from '../proyectos/guards/alcance-proyecto.guard';
import { CreateObjetivoEspecificoDto } from './dto/create-objetivo-especifico.dto';
import { ObjetivosEspecificosService } from './objetivos-especificos.service';

/** HU SGP-162: objetivos específicos de un proyecto. */
@ApiTags('Objetivos específicos')
@Controller('proyectos/:proyectoId/objetivos')
export class ObjetivosEspecificosController {
  constructor(private readonly objetivos: ObjetivosEspecificosService) {}

  /** Listar objetivos del proyecto. El Técnico solo ve los suyos. */
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.SUPERVISOR, RolUsuario.TECNICO)
  @AlcanceProyecto('proyectoId')
  @Get()
  obtenerPorProyecto(@Param('proyectoId', ParseUUIDPipe) proyectoId: string) {
    return this.objetivos.obtenerPorProyecto(proyectoId);
  }

  /** Registrar un objetivo específico (Director / Administrador). */
  @Roles(RolUsuario.ADMINISTRADOR)
  @Post()
  crearObjetivo(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Body() dto: CreateObjetivoEspecificoDto,
  ) {
    return this.objetivos.crearObjetivo(proyectoId, dto);
  }
}
