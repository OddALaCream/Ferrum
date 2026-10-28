import { PartialType } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ESTADOS_TAREA, type EstadoTarea } from '../entities/tarea.entity';
import { FechaIso } from './fecha';

export class CrearTareaDto {
  /** Qué hay que hacer, por ejemplo "Reunirse con los jefes de manzana". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  nombre!: string;

  @IsOptional()
  @IsUUID()
  responsableId?: string;

  @IsOptional()
  @FechaIso('fechaLimite')
  fechaLimite?: string;
}

export class EditarTareaDto extends PartialType(CrearTareaDto) {
  @IsOptional()
  @IsIn(ESTADOS_TAREA as readonly string[], { message: 'estado debe ser PENDIENTE, EN_CURSO o COMPLETADA' })
  estado?: EstadoTarea;
}