import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateBy,
} from 'class-validator';

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function HastaNoAnteriorADesde(): PropertyDecorator {
  return ValidateBy({
    name: 'hastaNoAnteriorADesde',
    validator: {
      validate: (hasta: unknown, args) => {
        const { desde } = args?.object as ConsultarAuditoriaDto;
        return typeof hasta !== 'string' || typeof desde !== 'string' || hasta >= desde;
      },
      defaultMessage: () => 'La fecha "hasta" no puede ser anterior a la fecha "desde".',
    },
  });
}

/** Filtros de GET /auditoria (RF-34 / SGP-59). Las fechas se interpretan en America/La_Paz. */
export class ConsultarAuditoriaDto {
  @IsOptional()
  @IsUUID('all', { message: 'usuarioId debe ser un UUID válido.' })
  usuarioId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'entidad admite como máximo 60 caracteres.' })
  entidad?: string;

  @IsOptional()
  @IsUUID('all', { message: 'proyectoId debe ser un UUID válido.' })
  proyectoId?: string;

  @IsOptional()
  @Matches(FECHA_ISO, { message: 'desde debe tener el formato YYYY-MM-DD.' })
  desde?: string;

  @IsOptional()
  @Matches(FECHA_ISO, { message: 'hasta debe tener el formato YYYY-MM-DD.' })
  @HastaNoAnteriorADesde()
  hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pagina debe ser un número entero.' })
  @Min(1, { message: 'pagina debe ser mayor o igual a 1.' })
  pagina: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limite debe ser un número entero.' })
  @Min(1, { message: 'limite debe ser mayor o igual a 1.' })
  @Max(100, { message: 'limite admite como máximo 100.' })
  limite: number = 20;
}
