import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CrearIndicadorDto {
  /** Código del indicador, por ejemplo "I.O.V. 1.1". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  codigo!: string;

  /** Qué se mide, por ejemplo "Al final del proyecto, al menos el 80 % de los cultivos se han caracterizado". */
  @IsString()
  @IsNotEmpty()
  descripcion!: string;

  /** Unidad del valor meta: "%", "beneficiarios", "asociaciones"… */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unidad!: string;

  /** Valor de partida. Si no se indica es 0. Debe ser distinto de la meta. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  lineaBase?: number;

  /** Valor que se quiere alcanzar ("Valor indicador" del marco lógico), por ejemplo 80. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  meta!: number;

  /** Peso del indicador dentro de su resultado (0 a 100). La suma por resultado no puede pasar de 100. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  peso?: number;

  /** Fuentes de verificación (F.V.): qué documentos o registros prueban el indicador. */
  @IsString()
  @IsNotEmpty()
  fuenteVerificacion!: string;

  @IsOptional()
  @IsUUID()
  responsableId?: string;
}

export class EditarIndicadorDto extends PartialType(CrearIndicadorDto) {}