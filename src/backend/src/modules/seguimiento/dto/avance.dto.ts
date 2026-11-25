import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { FechaIso } from '../../marco-logico/dto/fecha';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value);

export class CrearAvanceDto {
  /** El indicador (I.O.V.) al que aporta. Va este o `actividadId`, nunca los dos. */
  @IsOptional()
  @IsUUID('all', { message: 'iovId debe ser un UUID' })
  iovId?: string;

  /** La actividad a la que aporta. Va esta o `iovId`, nunca las dos. */
  @IsOptional()
  @IsUUID('all', { message: 'actividadId debe ser un UUID' })
  actividadId?: string;

  /** Cantidad alcanzada en este periodo, en la unidad del indicador (p. ej. 40 beneficiarios). Obligatoria en un indicador. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'valorReportado debe ser un número con hasta 2 decimales' })
  @Min(0, { message: 'valorReportado no puede ser negativo' })
  valorReportado?: number;

  /** Hasta qué día se mide este avance (YYYY-MM-DD). */
  @FechaIso('fechaCorte')
  fechaCorte!: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(2000, { message: 'descripcion admite como máximo 2000 caracteres' })
  descripcion?: string;
}

/** Solo se corrigen los datos del avance; a qué indicador o actividad pertenece no cambia. */
export class EditarAvanceDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'valorReportado debe ser un número con hasta 2 decimales' })
  @Min(0, { message: 'valorReportado no puede ser negativo' })
  valorReportado?: number;

  @IsOptional()
  @FechaIso('fechaCorte')
  fechaCorte?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(2000, { message: 'descripcion admite como máximo 2000 caracteres' })
  descripcion?: string;
}

export class ListarAvancesDto {
  @IsOptional()
  @IsUUID('all', { message: 'iovId debe ser un UUID' })
  iovId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'actividadId debe ser un UUID' })
  actividadId?: string;
}