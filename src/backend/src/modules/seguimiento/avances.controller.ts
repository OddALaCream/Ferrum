import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../auth/types/auth.types';
import { AlcanceProyecto } from '../proyectos/guards/alcance-proyecto.guard';
import { RolUsuario } from '../proyectos/entities/usuario.entity';
import { AvancesService } from './avances.service';
import { CrearAvanceDto, EditarAvanceDto, ListarAvancesDto, ObservarAvanceDto } from './dto/avance.dto';
import { SubidaEvidenciaInterceptor } from './subida-evidencia.interceptor';
import type { ArchivoSubido } from './utils/archivo';

const uuid = new ParseUUIDPipe();

/** SGP-82: avances de indicadores y actividades, con sus evidencias. */
@ApiTags('Avances y evidencias')
@Controller('proyectos/:proyectoId/avances')
export class AvancesController {
  constructor(private readonly avances: AvancesService) {}

  /** El Técnico ve sus avances (también borradores); Administrador y Supervisor, los enviados en adelante. */
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.SUPERVISOR, RolUsuario.TECNICO)
  @AlcanceProyecto('proyectoId')
  @Get()
  listar(
    @Param('proyectoId', uuid) proyectoId: string,
    @Query() filtros: ListarAvancesDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.avances.listar(proyectoId, filtros, usuario);
  }

  /** CP-11: el técnico responsable registra un avance; queda en BORRADOR. */
  @Roles(RolUsuario.TECNICO)
  @AlcanceProyecto('proyectoId')
  @Post()
  crear(@Param('proyectoId', uuid) proyectoId: string, @Body() dto: CrearAvanceDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.avances.crear(proyectoId, dto, usuario);
  }

  @Roles(RolUsuario.TECNICO)
  @AlcanceProyecto('proyectoId')
  @Patch(':avanceId')
  editar(
    @Param('proyectoId', uuid) proyectoId: string,
    @Param('avanceId', uuid) avanceId: string,
    @Body() dto: EditarAvanceDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.avances.editar(proyectoId, avanceId, dto, usuario);
  }

  @Roles(RolUsuario.TECNICO)
  @AlcanceProyecto('proyectoId')
  @Delete(':avanceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(
    @Param('proyectoId', uuid) proyectoId: string,
    @Param('avanceId', uuid) avanceId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.avances.eliminar(proyectoId, avanceId, usuario);
  }

  /** RF-12 / RN-04: adjunta una evidencia (PDF, JPG, PNG o WEBP de hasta 25 MB) en el campo "archivo". */
  @Roles(RolUsuario.TECNICO)
  @AlcanceProyecto('proyectoId')
  @Post(':avanceId/evidencias')
  @UseInterceptors(SubidaEvidenciaInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['archivo'], properties: { archivo: { type: 'string', format: 'binary' } } } })
  subirEvidencia(
    @Param('proyectoId', uuid) proyectoId: string,
    @Param('avanceId', uuid) avanceId: string,
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.avances.subirEvidencia(proyectoId, avanceId, archivo, usuario);
  }

  @Roles(RolUsuario.TECNICO)
  @AlcanceProyecto('proyectoId')
  @Delete(':avanceId/evidencias/:evidenciaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarEvidencia(
    @Param('proyectoId', uuid) proyectoId: string,
    @Param('avanceId', uuid) avanceId: string,
    @Param('evidenciaId', uuid) evidenciaId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    await this.avances.eliminarEvidencia(proyectoId, avanceId, evidenciaId, usuario);
  }

  /** Enlace temporal (5 minutos) para descargar una evidencia. */
  @Roles(RolUsuario.ADMINISTRADOR, RolUsuario.SUPERVISOR, RolUsuario.TECNICO)
  @AlcanceProyecto('proyectoId')
  @Get(':avanceId/evidencias/:evidenciaId/descarga')
  descargar(
    @Param('proyectoId', uuid) proyectoId: string,
    @Param('avanceId', uuid) avanceId: string,
    @Param('evidenciaId', uuid) evidenciaId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.avances.urlDescarga(proyectoId, avanceId, evidenciaId, usuario);
  }

  /** CP-12: envía el avance a revisión; sin al menos una evidencia se rechaza. */
  @Roles(RolUsuario.TECNICO)
  @AlcanceProyecto('proyectoId')
  @Post(':avanceId/enviar')
  @HttpCode(HttpStatus.OK)
  enviar(
    @Param('proyectoId', uuid) proyectoId: string,
    @Param('avanceId', uuid) avanceId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.avances.enviar(proyectoId, avanceId, usuario);
  }

  /** SGP-94: el Administrador aprueba un avance enviado. Técnico y Supervisor reciben 403 (CP-18). */
  @Roles(RolUsuario.ADMINISTRADOR)
  @AlcanceProyecto('proyectoId')
  @Patch(':avanceId/aprobar')
  aprobar(
    @Param('proyectoId', uuid) proyectoId: string,
    @Param('avanceId', uuid) avanceId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.avances.aprobar(proyectoId, avanceId, usuario);
  }

  /** SGP-94 / CP-27: el Administrador observa un avance enviado; la observación es obligatoria. */
  @Roles(RolUsuario.ADMINISTRADOR)
  @AlcanceProyecto('proyectoId')
  @Patch(':avanceId/observar')
  observar(
    @Param('proyectoId', uuid) proyectoId: string,
    @Param('avanceId', uuid) avanceId: string,
    @Body() dto: ObservarAvanceDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.avances.observar(proyectoId, avanceId, dto, usuario);
  }
}