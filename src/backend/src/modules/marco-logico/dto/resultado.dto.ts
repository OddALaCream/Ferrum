import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CrearResultadoDto {
  /** Código del resultado dentro del proyecto, por ejemplo "R.1". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  codigo!: string;

  /** Qué se espera lograr, por ejemplo "Las personas de la zona se llevan bien". */
  @IsString()
  @IsNotEmpty()
  descripcion!: string;

  /** Peso del resultado en el proyecto (0 a 100). Opcional. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  peso?: number;
}

export class EditarResultadoDto extends PartialType(CrearResultadoDto) {}