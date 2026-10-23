import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { RegistrarPresupuestoDto } from './dto/registrar-presupuesto.dto';
import { UpdateEstadoProyectoDto } from './dto/update-estado-proyecto.dto';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectosService } from './proyectos.service';

@Controller('proyectos')
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Post()
  crear(@Body() dto: CreateProyectoDto) {
    return this.proyectosService.crear(dto);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.proyectosService.obtenerPorId(id);
  }

  @Patch(':id/estado')
  actualizarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEstadoProyectoDto,
  ) {
    return this.proyectosService.actualizarEstado(id, dto);
  }

  /**
   * RF-02 / SGP-7: registra el presupuesto total aprobado del proyecto.
   * La restricción al rol Director se aplicará con el guard del módulo auth.
   */
  @Patch(':id/presupuesto')
  registrarPresupuesto(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RegistrarPresupuestoDto,
  ): Promise<Proyecto> {
    return this.proyectosService.registrarPresupuesto(id, dto);
  }
}
