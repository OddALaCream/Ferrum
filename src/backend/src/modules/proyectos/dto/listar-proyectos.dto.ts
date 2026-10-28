import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ESTADOS_PROYECTO, type EstadoProyecto } from '../entities/proyecto.entity';

export class ListarProyectosDto {
  /** Busca en el código y en el nombre del proyecto. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(ESTADOS_PROYECTO as readonly string[], { message: 'El estado debe ser PLANIFICACION, EN_EJECUCION, PAUSADO o CERRADO.' })
  estado?: EstadoProyecto;

  /** Página, desde 1. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /** Proyectos por página (1 a 50; por defecto 10). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}