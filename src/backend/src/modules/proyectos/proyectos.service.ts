import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegistrarPresupuestoDto } from './dto/registrar-presupuesto.dto';
import { Proyecto } from './entities/proyecto.entity';
import { normalizarMonto } from './presupuesto';

@Injectable()
export class ProyectosService {
  constructor(@InjectRepository(Proyecto) private readonly proyectos: Repository<Proyecto>) {}

  /** RF-02 / CP-02: registra el presupuesto total aprobado con su moneda. */
  async registrarPresupuesto(id: string, dto: RegistrarPresupuestoDto): Promise<Proyecto> {
    const proyecto = await this.proyectos.findOneBy({ id });
    if (!proyecto) throw new NotFoundException('El proyecto no existe.');

    // RN-09: un proyecto cerrado es de solo lectura
    if (proyecto.estado === 'CERRADO') {
      throw new UnprocessableEntityException('No se puede modificar el presupuesto de un proyecto cerrado (RN-09).');
    }

    proyecto.presupuestoTotal = normalizarMonto(dto.monto);
    proyecto.moneda = dto.moneda;
    return this.proyectos.save(proyecto);
  }
}
