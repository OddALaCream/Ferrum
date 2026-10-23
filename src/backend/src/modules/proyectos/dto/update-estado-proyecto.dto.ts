import { IsIn } from 'class-validator';
import { ESTADOS_PROYECTO, type EstadoProyecto } from '../entities/proyecto.entity';

export class UpdateEstadoProyectoDto {
  @IsIn(ESTADOS_PROYECTO)
  estado!: EstadoProyecto;
}
