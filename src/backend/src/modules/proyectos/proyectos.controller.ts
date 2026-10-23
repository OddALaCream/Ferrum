import { Body, Controller, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { RegistrarPresupuestoDto } from './dto/registrar-presupuesto.dto';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectosService } from './proyectos.service';

@Controller('proyectos')
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  /**
   * RF-02: registra el presupuesto total aprobado del proyecto.
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
