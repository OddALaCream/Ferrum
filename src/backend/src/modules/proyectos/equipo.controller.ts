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
import { AsignarTecnicoDto } from './dto/asignar-tecnico.dto';
import { EquipoService } from './equipo.service';

@Controller('proyectos/:proyectoId/equipo')
export class EquipoController {
  constructor(private readonly equipoService: EquipoService) {}

  @Get()
  listar(@Param('proyectoId', ParseUUIDPipe) proyectoId: string) {
    return this.equipoService.listar(proyectoId);
  }

  /** Debe declararse antes de rutas con `:usuarioId` para no capturar "disponibles" como UUID. */
  @Get('disponibles')
  disponibles(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Query('q') q?: string,
  ) {
    return this.equipoService.buscarDisponibles(proyectoId, q ?? '');
  }

  @Post()
  asignar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Body() dto: AsignarTecnicoDto,
  ) {
    return this.equipoService.asignar(proyectoId, dto.usuarioId);
  }

  @Delete(':usuarioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async retirar(
    @Param('proyectoId', ParseUUIDPipe) proyectoId: string,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
  ): Promise<void> {
    await this.equipoService.retirar(proyectoId, usuarioId);
  }
}
