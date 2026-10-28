import { OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { TIPOS_CRONOGRAMA, type TipoCronograma } from '../entities/actividad.entity';
import { FECHA_ISO, FechaIso } from './fecha';

export class CrearActividadDto {
  /** Código de la actividad, por ejemplo "A.1.4". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  codigo!: string;

  /** Título corto de la actividad. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  nombre!: string;

  /** Descripción completa tal como está en el marco lógico. */
  @IsOptional()
  @IsString()
  descripcion?: string;

  /** CONTINUO: corre de principio a fin. DISCRETO: ocurre en sesiones puntuales. */
  @IsEnum(TIPOS_CRONOGRAMA, { message: 'tipoCronograma debe ser CONTINUO o DISCRETO' })
  tipoCronograma!: TipoCronograma;

  @FechaIso('fechaInicio')
  fechaInicio!: string;

  @FechaIso('fechaFin')
  fechaFin!: string;

  /** Técnico del equipo que rinde cuentas de la actividad. */
  @IsOptional()
  @IsUUID()
  responsableId?: string;

  /** Indicador (del mismo resultado) al que contribuye. */
  @IsOptional()
  @IsUUID()
  iovId?: string;

  /** "Número" del marco lógico, por ejemplo 10. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  metaCuantitativa?: number;

  /** Unidad de la meta, por ejemplo "sesiones de capacitación". */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  unidadMeta?: string;

  @IsOptional()
  @IsString()
  fuentesVerificacion?: string;

  /** Solo para actividades DISCRETAS: las fechas puntuales en que ocurre (YYYY-MM-DD). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(366)
  @Matches(FECHA_ISO, { each: true, message: 'cada sesión debe tener el formato YYYY-MM-DD' })
  sesiones?: string[];
}

export class EditarActividadDto extends PartialType(OmitType(CrearActividadDto, ['sesiones', 'tipoCronograma'] as const)) {}

export class CambiarEstadoActividadDto {
  @IsIn(['PENDIENTE', 'EN_CURSO', 'COMPLETADA'], { message: 'estado debe ser PENDIENTE, EN_CURSO o COMPLETADA' })
  estado!: 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADA';

  /** Solo actividades CONTINUAS: avance de 0 a 100. Con 100 la actividad queda completada. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  cumplimientoPct?: number;
}

export class AgregarSesionesDto {
  @IsArray()
  @ArrayMaxSize(366)
  @Matches(FECHA_ISO, { each: true, message: 'cada sesión debe tener el formato YYYY-MM-DD' })
  fechas!: string[];
}

export class MarcarSesionDto {
  @IsIn([true, false], { message: 'realizada debe ser true o false' })
  realizada!: boolean;
}