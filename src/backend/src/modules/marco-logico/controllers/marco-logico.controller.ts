import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolUsuario } from '../../proyectos/entities/usuario.entity';
import { AlcanceProyecto } from '../../proyectos/guards/alcance-proyecto.guard';
import { CrearIndicadorDto, EditarIndicadorDto } from '../dto/indicador.dto';
import { CrearResultadoDto, EditarResultadoDto } from '../dto/resultado.dto';
import { MarcoLogicoService } from '../services/marco-logico.service';

/** Marco lógico de un proyecto: resultados e indicadores. Todo lo que se escribe es del Administrador. */
@ApiTags('Marco lógico')
@Controller('proyectos/:proyectoId')
export class MarcoLogicoController {
  constructor(private readonly marcoLogico: MarcoLogicoService) {}

  /** Árbol completo: resultados → indicadores y actividades (con sesiones y tareas). El Técnico solo ve sus proyectos. */
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.SUPERVISOR, RolUsuario.TECNICO)
  @AlcanceProyecto('proyectoId')
  @Get('marco-logico')
  arbol(@Param('proyectoId', ParseUUIDPipe) proyectoId: string) {
    return this.marcoLogico.arbol(proyectoId);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('resultados')
  crearResultado(@Param('proyectoId', ParseUUIDPipe) proyectoId: string, @Body() dto: CrearResultadoDto) {
    return this.marcoLogico.crearResultado(proyectoId, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch('resultados/:resultadoId')
  editarResultado(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('resultadoId', ParseUUIDPipe) resultadoId: string,
    @Body() dto: EditarResultadoDto,
  ) {
    return this.marcoLogico.editarResultado(proyectoId, resultadoId, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete('resultados/:resultadoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarResultado(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('resultadoId', ParseUUIDPipe) resultadoId: string,
  ): Promise<void> {
    await this.marcoLogico.eliminarResultado(proyectoId, resultadoId);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Post('resultados/:resultadoId/indicadores')
  crearIndicador(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('resultadoId', ParseUUIDPipe) resultadoId: string,
    @Body() dto: CrearIndicadorDto,
  ) {
    return this.marcoLogico.crearIndicador(proyectoId, resultadoId, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Patch('resultados/:resultadoId/indicadores/:indicadorId')
  editarIndicador(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('resultadoId', ParseUUIDPipe) resultadoId: string,
    @Param('indicadorId', ParseUUIDPipe) indicadorId: string,
    @Body() dto: EditarIndicadorDto,
  ) {
    return this.marcoLogico.editarIndicador(proyectoId, resultadoId, indicadorId, dto);
  }

  @Roles(RolUsuario.ADMINISTRADOR)
  @Delete('resultados/:resultadoId/indicadores/:indicadorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarIndicador(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('resultadoId', ParseUUIDPipe) resultadoId: string,
    @Param('indicadorId', ParseUUIDPipe) indicadorId: string,
  ): Promise<void> {
    await this.marcoLogico.eliminarIndicador(proyectoId, resultadoId, indicadorId);
  }
}