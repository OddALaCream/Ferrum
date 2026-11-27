import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { AlcanceProyecto } from '../proyectos/guards/alcance-proyecto.guard';
import { RolUsuario } from '../proyectos/entities/usuario.entity';
import { AvancesService } from './avances.service';
import { HistorialDto } from './dto/avance.dto';

/** SGP-116: historial de avances, revisiones y evidencias de cada indicador y actividad. */
@ApiTags('Avances y evidencias')
@Controller('proyectos/:proyectoId/historial')
export class HistorialController {
  constructor(private readonly avances: AvancesService) {}

  /**
   * CP-28: avances en orden cronológico con su estado, revisor y evidencias, y la línea de tiempo de cada uno.
   * Solo de los proyectos donde el usuario participa (el Administrador, de todos).
   */
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.SUPERVISOR, RolUsuario.TECNICO)
  @AlcanceProyecto('proyectoId')
  @Get()
  historial(
    @Param('proyectoId', new ParseUUIDPipe()) proyectoId: string,
    @Query() filtros: HistorialDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.avances.historial(proyectoId, filtros, usuario);
  }
}